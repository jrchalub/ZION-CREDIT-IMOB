import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  bankStatements,
  bankTransactions,
  documentClassifications,
  documentConsistencyChecks,
  documentExtractedFields,
  documentOcrResults,
  documentProcessingRuns,
  documentTypes,
  documents,
  pendencies,
} from "@/db/schema";
import { writeAuditLog } from "@/domain/audit/service";
import { applyExtractedDocumentValidity } from "@/domain/documents/document-validity-store";
import { sha256 } from "@/domain/documents/upload-validation";
import { getStorageProvider } from "@/infra/storage";
import { createLogger } from "@/lib/logger";
import { getOCRProvider } from "../ocr";
import { getDocumentAIProvider } from "../providers";
import {
  classificationResultSchema,
  extractionResultSchema,
  mapToKnownTypeCode,
} from "../schemas/classification";
import { logAiRequest } from "./AiRequestLogService";
import { decideClassification } from "./ConfidencePolicy";
import { runDocumentConsistency } from "./DocumentConsistencyService";

type ProcessInput = {
  documentId: string;
  tenantId: string;
  processId: string;
  correlationId?: string;
  jobId?: string;
  attempt?: number;
};

async function upsertAutomaticPendency(input: {
  tenantId: string;
  processId: string;
  documentId: string;
  type: string;
  description: string;
  priority?: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
}) {
  const idempotencyKey = `${input.processId}:${input.documentId}:${input.type}`;
  const [existing] = await db
    .select({ id: pendencies.id })
    .from(pendencies)
    .where(
      and(
        eq(pendencies.tenantId, input.tenantId),
        eq(pendencies.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(pendencies)
    .values({
      tenantId: input.tenantId,
      processId: input.processId,
      documentId: input.documentId,
      type: input.type,
      title: input.type.slice(0, 200),
      description: input.description,
      priority: input.priority ?? "MEDIA",
      status: "OPEN",
      idempotencyKey,
    })
    .returning();
  return created;
}

async function updateRunStatus(
  runId: string,
  status: (typeof documentProcessingRuns.$inferInsert)["status"],
  patch?: Partial<typeof documentProcessingRuns.$inferInsert>,
) {
  await db
    .update(documentProcessingRuns)
    .set({ status, updatedAt: new Date(), ...patch })
    .where(eq(documentProcessingRuns.id, runId));
}

/**
 * Orchestrates OCR → classify → extract → validate → consistency.
 * Never marks documents.status as VALIDADO (human only).
 */
export async function processDocumentJob(input: ProcessInput) {
  const log = createLogger("document-processing", input.correlationId);
  const jobId = input.jobId ?? `doc-${input.documentId}`;

  // Idempotency: if a successful/review run already exists for this job, skip
  const [existingDone] = await db
    .select()
    .from(documentProcessingRuns)
    .where(
      and(
        eq(documentProcessingRuns.documentId, input.documentId),
        inArray(documentProcessingRuns.status, [
          "COMPLETED",
          "REQUIRES_REVIEW",
        ]),
      ),
    )
    .orderBy(desc(documentProcessingRuns.createdAt))
    .limit(1);

  if (existingDone && existingDone.jobId === jobId) {
    log.info("Skipping duplicate completed run", { runId: existingDone.id });
    return existingDone;
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, input.documentId),
        eq(documents.tenantId, input.tenantId),
      ),
    )
    .limit(1);

  if (!doc) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  const [run] = await db
    .insert(documentProcessingRuns)
    .values({
      tenantId: input.tenantId,
      documentId: input.documentId,
      processId: input.processId,
      status: "QUEUED",
      correlationId: input.correlationId ?? null,
      jobId,
      attemptCount: input.attempt ?? 1,
      startedAt: new Date(),
    })
    .onConflictDoNothing({ target: documentProcessingRuns.jobId })
    .returning();

  let runId = run?.id;
  if (!runId) {
    const [existingJob] = await db
      .select()
      .from(documentProcessingRuns)
      .where(eq(documentProcessingRuns.jobId, jobId))
      .limit(1);
    if (existingJob && ["COMPLETED", "REQUIRES_REVIEW"].includes(existingJob.status)) {
      return existingJob;
    }
    runId = existingJob?.id;
    if (!runId) {
      const [created] = await db
        .insert(documentProcessingRuns)
        .values({
          tenantId: input.tenantId,
          documentId: input.documentId,
          processId: input.processId,
          status: "PROCESSING",
          correlationId: input.correlationId ?? null,
          jobId: `${jobId}-${Date.now()}`,
          attemptCount: input.attempt ?? 1,
          startedAt: new Date(),
        })
        .returning();
      runId = created.id;
    }
  }

  await writeAuditLog({
    tenantId: input.tenantId,
    action: "DOCUMENT_PROCESSING_STARTED",
    entity: "document",
    entityId: input.documentId,
    newValue: { runId, jobId },
    correlationId: input.correlationId,
  });

  // Document lifecycle: processing in progress (not validated)
  await db
    .update(documents)
    .set({ status: "PROCESSANDO", updatedAt: new Date() })
    .where(eq(documents.id, input.documentId));

  try {
    await updateRunStatus(runId, "PROCESSING");

    const storage = getStorageProvider();
    const buffer = await storage.getObject(doc.storageKey);
    const hash = sha256(buffer);
    if (hash !== doc.contentHash) {
      throw new Error("INTEGRITY_HASH_MISMATCH");
    }

    // OCR / native text
    await updateRunStatus(runId, "OCR_PROCESSING");
    const ocr = getOCRProvider();
    const ocrStarted = Date.now();
    const ocrResult = await ocr.extractText({
      buffer,
      mimeType: doc.mimeType,
      filename: doc.originalFilename,
    });

    await db.insert(documentOcrResults).values({
      tenantId: input.tenantId,
      documentId: input.documentId,
      processingRunId: runId,
      provider: ocrResult.provider,
      providerVersion: ocrResult.providerVersion,
      text: ocrResult.text,
      pages: ocrResult.pages,
      confidence: String(ocrResult.confidence),
      processingTimeMs: ocrResult.processingTimeMs || Date.now() - ocrStarted,
      method: ocrResult.method,
    });

    await writeAuditLog({
      tenantId: input.tenantId,
      action: "OCR_COMPLETED",
      entity: "document",
      entityId: input.documentId,
      newValue: {
        method: ocrResult.method,
        pages: ocrResult.pages,
        confidence: ocrResult.confidence,
      },
      correlationId: input.correlationId,
    });

    const types = await db.select().from(documentTypes).where(eq(documentTypes.active, true));
    const knownCodes = types.map((t) => t.code);

    // Classification
    await updateRunStatus(runId, "CLASSIFYING");
    const ai = getDocumentAIProvider();
    const classifyStarted = Date.now();
    const classificationRaw = await ai.classify({
      text: ocrResult.text,
      mimeType: doc.mimeType,
      filename: doc.originalFilename,
      knownTypeCodes: knownCodes,
    });
    const classification = classificationResultSchema.parse(classificationRaw);
    const matchedCode = mapToKnownTypeCode(classification.documentType, knownCodes);
    const decision = matchedCode
      ? decideClassification(classification.confidence)
      : ("REQUIRES_REVIEW" as const);
    const matchedType = matchedCode
      ? types.find((t) => t.code === matchedCode)
      : undefined;

    await db.insert(documentClassifications).values({
      tenantId: input.tenantId,
      documentId: input.documentId,
      processingRunId: runId,
      suggestedTypeCode: matchedCode ?? classification.documentType.slice(0, 80),
      matchedDocumentTypeId: matchedType?.id ?? null,
      confidence: String(classification.confidence),
      decision,
      provider: classification.provider,
      model: classification.model ?? null,
      promptVersion: classification.promptVersion,
    });

    await logAiRequest({
      tenantId: input.tenantId,
      documentId: input.documentId,
      processingRunId: runId,
      provider: classification.provider,
      model: classification.model,
      operation: "classify",
      promptVersion: classification.promptVersion,
      requestPayloadHashSource: `${doc.contentHash}:classify`,
      status: "ok",
      durationMs: Date.now() - classifyStarted,
      summary: {
        documentType: matchedCode ?? classification.documentType,
        confidence: classification.confidence,
        decision,
      },
    });

    await writeAuditLog({
      tenantId: input.tenantId,
      action: "DOCUMENT_CLASSIFIED",
      entity: "document",
      entityId: input.documentId,
      newValue: {
        type: matchedCode ?? classification.documentType,
        confidence: classification.confidence,
        decision,
      },
      correlationId: input.correlationId,
    });

    if (decision === "LOW_CONFIDENCE" || !matchedCode) {
      await upsertAutomaticPendency({
        tenantId: input.tenantId,
        processId: input.processId,
        documentId: input.documentId,
        type: matchedCode ? "LOW_CONFIDENCE" : "UNIDENTIFIED_DOCUMENT",
        description: matchedCode
          ? "Classificação com baixa confiança — revisão humana necessária"
          : "Documento não identificado — selecione o tipo",
        priority: "ALTA",
      });
      await updateRunStatus(runId, "REQUIRES_REVIEW", { finishedAt: new Date() });
      await db
        .update(documents)
        .set({
          status: "RECEBIDO",
          classificationConfidence: String(classification.confidence),
          updatedAt: new Date(),
        })
        .where(eq(documents.id, input.documentId));
      return { runId, status: "REQUIRES_REVIEW" as const };
    }

    // Extraction
    await updateRunStatus(runId, "EXTRACTING");
    const extractStarted = Date.now();
    const extractionRaw = await ai.extract({
      text: ocrResult.text,
      documentType: matchedCode,
      mimeType: doc.mimeType,
      filename: doc.originalFilename,
    });
    const extraction = extractionResultSchema.parse(extractionRaw);

    // Replace prior fields for this document from AI (idempotent re-run)
    await db
      .delete(documentExtractedFields)
      .where(
        and(
          eq(documentExtractedFields.documentId, input.documentId),
          eq(documentExtractedFields.tenantId, input.tenantId),
        ),
      );

    if (extraction.fields.length > 0) {
      await db.insert(documentExtractedFields).values(
        extraction.fields.map((field) => ({
          tenantId: input.tenantId,
          documentId: input.documentId,
          processingRunId: runId,
          field: field.field,
          value: field.value,
          normalizedValue: field.normalizedValue ?? null,
          confidence: String(field.confidence),
          page: field.page ?? null,
          evidenceText: field.evidenceText ?? null,
          boundingBox: field.boundingBox ?? null,
          provider: extraction.provider,
          model: extraction.model ?? null,
          promptVersion: extraction.promptVersion,
        })),
      );
    }

    // Bank statement extension (extract only — no income analysis)
    if (matchedCode === "EXTRATO_BANCARIO") {
      const [statement] = await db
        .insert(bankStatements)
        .values({
          tenantId: input.tenantId,
          documentId: input.documentId,
          processingRunId: runId,
          holderName:
            extraction.fields.find((f) => f.field === "full_name")?.value ?? null,
          bankName:
            extraction.fields.find((f) => f.field === "bank_name")?.value ?? null,
          periodStart:
            extraction.fields.find((f) => f.field === "period_start")?.value ?? null,
          periodEnd:
            extraction.fields.find((f) => f.field === "period_end")?.value ?? null,
        })
        .returning();

      const txs = (extraction.extras?.transactions as Array<Record<string, unknown>>) ?? [];
      if (txs.length > 0) {
        await db.insert(bankTransactions).values(
          txs.map((tx) => ({
            tenantId: input.tenantId,
            bankStatementId: statement.id,
            transactionDate: String(tx.transactionDate ?? ""),
            description: String(tx.description ?? ""),
            amount: String(tx.amount ?? "0"),
            direction: (tx.direction === "DEBIT" ? "DEBIT" : "CREDIT") as
              | "CREDIT"
              | "DEBIT",
            category: String(tx.category ?? "UNKNOWN"),
            classificationConfidence: String(tx.classificationConfidence ?? 0),
            evidencePage:
              typeof tx.evidencePage === "number" ? tx.evidencePage : null,
          })),
        );
      }
    }

    await logAiRequest({
      tenantId: input.tenantId,
      documentId: input.documentId,
      processingRunId: runId,
      provider: extraction.provider,
      model: extraction.model,
      operation: "extract",
      promptVersion: extraction.promptVersion,
      requestPayloadHashSource: `${doc.contentHash}:extract:${matchedCode}`,
      status: "ok",
      durationMs: Date.now() - extractStarted,
      summary: { fieldCount: extraction.fields.length, type: matchedCode },
    });

    await writeAuditLog({
      tenantId: input.tenantId,
      action: "DOCUMENT_EXTRACTED",
      entity: "document",
      entityId: input.documentId,
      newValue: { fieldCount: extraction.fields.length },
      correlationId: input.correlationId,
    });

    // Consistency validation
    await updateRunStatus(runId, "VALIDATING");
    const consistency = await runDocumentConsistency({
      tenantId: input.tenantId,
      processId: input.processId,
      documentId: input.documentId,
    });

    await db.insert(documentConsistencyChecks).values({
      tenantId: input.tenantId,
      processId: input.processId,
      documentId: input.documentId,
      processingRunId: runId,
      consistencyScore: consistency.consistencyScore,
      issues: consistency.issues,
      factors: consistency.factors,
    });

    for (const issue of consistency.issues) {
      await upsertAutomaticPendency({
        tenantId: input.tenantId,
        processId: input.processId,
        documentId: input.documentId,
        type: issue.type,
        description: issue.message,
        priority: issue.type.includes("MISMATCH") ? "ALTA" : "MEDIA",
      });
    }

    const requiresReview =
      decision === "REQUIRES_REVIEW" || consistency.issues.length > 0;

    const finalStatus = requiresReview ? "REQUIRES_REVIEW" : "COMPLETED";
    await updateRunStatus(runId, finalStatus, { finishedAt: new Date() });

    // Back to RECEBIDO awaiting human validation — never VALIDADO by AI
    await db
      .update(documents)
      .set({
        status: "RECEBIDO",
        classificationConfidence: String(classification.confidence),
        extractionConfidence: String(
          extraction.fields.reduce((acc, f) => acc + f.confidence, 0) /
            Math.max(1, extraction.fields.length),
        ),
        pageCount: ocrResult.pages,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, input.documentId));

    await applyExtractedDocumentValidity({
      tenantId: input.tenantId,
      processId: input.processId,
      documentId: input.documentId,
      checklistItemId: doc.checklistItemId,
      typeCode: matchedCode,
      fields: extraction.fields,
    });

    if (requiresReview) {
      await upsertAutomaticPendency({
        tenantId: input.tenantId,
        processId: input.processId,
        documentId: input.documentId,
        type: "REQUIRES_REVIEW",
        description: "Pipeline concluído — aguardando validação humana",
        priority: "MEDIA",
      });
    }

    await writeAuditLog({
      tenantId: input.tenantId,
      action: "DOCUMENT_VALIDATION_STARTED",
      entity: "document",
      entityId: input.documentId,
      newValue: {
        pipelineStatus: finalStatus,
        note: "COMPLETED ≠ VALIDADO — validação humana pendente",
        consistencyScore: consistency.consistencyScore,
      },
      correlationId: input.correlationId,
    });

    log.info("Document processing finished", { runId, finalStatus });
    return { runId, status: finalStatus };
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const permanent = [
      "INTEGRITY_HASH_MISMATCH",
      "DOCUMENT_NOT_FOUND",
      "MOCK_INVALID_JSON",
      "MOCK_OCR_ERROR",
    ].includes(message);

    await updateRunStatus(runId, "FAILED", {
      finishedAt: new Date(),
      errorCode: message,
      errorMessage: message,
      attemptCount: input.attempt ?? 1,
    });

    await db
      .update(documents)
      .set({ status: "RECEBIDO", updatedAt: new Date() })
      .where(eq(documents.id, input.documentId));

    await upsertAutomaticPendency({
      tenantId: input.tenantId,
      processId: input.processId,
      documentId: input.documentId,
      type: "PROCESSING_FAILED",
      description: `Falha no processamento automático: ${message}`,
      priority: "ALTA",
    });

    await logAiRequest({
      tenantId: input.tenantId,
      documentId: input.documentId,
      processingRunId: runId,
      provider: process.env.AI_PROVIDER ?? "mock",
      operation: "process",
      status: "error",
      errorMessage: message,
      summary: { permanent },
      rawValid: false,
    });

    if (!permanent) throw error;
    return { runId, status: "FAILED" as const, error: message };
  }
}
