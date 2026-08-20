import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  documentClassifications,
  documentConsistencyChecks,
  documentExtractedFields,
  documentFieldCorrections,
  documentOcrResults,
  documentProcessingRuns,
  documents,
} from "@/db/schema";
import { writeAuditLog } from "@/domain/audit/service";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";

export async function getDocumentIntelligence(
  session: SessionPayload,
  documentId: string,
) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(
      and(eq(documents.id, documentId), eq(documents.tenantId, session.tenantId)),
    )
    .limit(1);
  if (!doc) throw new AppError(404, "Documento não encontrado", "DOCUMENT_NOT_FOUND");

  const [run] = await db
    .select()
    .from(documentProcessingRuns)
    .where(
      and(
        eq(documentProcessingRuns.documentId, documentId),
        eq(documentProcessingRuns.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(documentProcessingRuns.createdAt))
    .limit(1);

  const [ocr] = await db
    .select()
    .from(documentOcrResults)
    .where(
      and(
        eq(documentOcrResults.documentId, documentId),
        eq(documentOcrResults.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(documentOcrResults.createdAt))
    .limit(1);

  const [classification] = await db
    .select()
    .from(documentClassifications)
    .where(
      and(
        eq(documentClassifications.documentId, documentId),
        eq(documentClassifications.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(documentClassifications.createdAt))
    .limit(1);

  const fields = await db
    .select()
    .from(documentExtractedFields)
    .where(
      and(
        eq(documentExtractedFields.documentId, documentId),
        eq(documentExtractedFields.tenantId, session.tenantId),
      ),
    );

  const [consistency] = await db
    .select()
    .from(documentConsistencyChecks)
    .where(
      and(
        eq(documentConsistencyChecks.documentId, documentId),
        eq(documentConsistencyChecks.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(documentConsistencyChecks.createdAt))
    .limit(1);

  const corrections = await db
    .select()
    .from(documentFieldCorrections)
    .where(
      and(
        eq(documentFieldCorrections.documentId, documentId),
        eq(documentFieldCorrections.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(documentFieldCorrections.createdAt));

  return {
    document: doc,
    processingRun: run ?? null,
    ocr: ocr
      ? {
          ...ocr,
          textPreview: ocr.text.slice(0, 500),
        }
      : null,
    classification: classification ?? null,
    fields,
    consistency: consistency ?? null,
    corrections,
    notes: {
      pipelineCompletedDoesNotMeanValidated: true,
      humanValidationRequired: doc.status !== "VALIDADO",
    },
  };
}

export const correctFieldSchema = z.object({
  field: z.string().min(1),
  extractedFieldId: z.uuid().optional().nullable(),
  aiValue: z.string().nullable().optional(),
  correctedValue: z.string().min(1),
  reason: z.string().max(1000).optional().nullable(),
});

export async function correctExtractedField(
  session: SessionPayload,
  documentId: string,
  input: z.infer<typeof correctFieldSchema>,
  meta?: { correlationId?: string },
) {
  const [doc] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(eq(documents.id, documentId), eq(documents.tenantId, session.tenantId)),
    )
    .limit(1);
  if (!doc) throw new AppError(404, "Documento não encontrado", "DOCUMENT_NOT_FOUND");

  const [correction] = await db
    .insert(documentFieldCorrections)
    .values({
      tenantId: session.tenantId,
      documentId,
      extractedFieldId: input.extractedFieldId ?? null,
      field: input.field,
      aiValue: input.aiValue ?? null,
      correctedValue: input.correctedValue,
      reason: input.reason ?? null,
      correctedByUserId: session.sub,
    })
    .returning();

  if (input.extractedFieldId) {
    await db
      .update(documentExtractedFields)
      .set({
        value: input.correctedValue,
        normalizedValue: input.correctedValue,
      })
      .where(
        and(
          eq(documentExtractedFields.id, input.extractedFieldId),
          eq(documentExtractedFields.tenantId, session.tenantId),
        ),
      );
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "EXTRACTION_CORRECTED",
    entity: "document",
    entityId: documentId,
    newValue: {
      field: input.field,
      aiValue: input.aiValue ?? null,
      correctedValue: input.correctedValue,
    },
    correlationId: meta?.correlationId,
  });

  return correction;
}

export async function getProcessingDashboardMetrics(tenantId: string) {
  const runs = await db
    .select({
      status: documentProcessingRuns.status,
    })
    .from(documentProcessingRuns)
    .where(eq(documentProcessingRuns.tenantId, tenantId));

  const counts = {
    processed: 0,
    processing: 0,
    requiresReview: 0,
    failed: 0,
    queued: 0,
  };

  for (const run of runs) {
    if (run.status === "COMPLETED") counts.processed += 1;
    else if (run.status === "REQUIRES_REVIEW") counts.requiresReview += 1;
    else if (run.status === "FAILED") counts.failed += 1;
    else if (run.status === "QUEUED") counts.queued += 1;
    else counts.processing += 1;
  }

  return counts;
}
