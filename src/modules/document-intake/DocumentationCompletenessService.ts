import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  bankStatements,
  clients,
  documentClassifications,
  documentProcessingRuns,
  documentTypes,
  documents,
  pendencies,
  processChecklistItems,
} from "@/db/schema";
import { loadProcessForSession } from "@/domain/access/scope";
import { getAnnexByCode } from "@/domain/documents/caixa-annex-catalog";
import { isExpiredOn } from "@/domain/documents/document-validity";
import type { SessionPayload } from "@/lib/auth/session";
import {
  deriveDocumentationStatus,
  statementPeriodSummary,
  visualSummaryLines,
  type CompletenessItem,
} from "./completeness-rules";
import { competenceFromPeriod, monthLabelPt, referenceMonths } from "./periods";

const PROCESSING_RUN = new Set([
  "PENDING",
  "QUEUED",
  "PROCESSING",
  "OCR_PROCESSING",
  "CLASSIFYING",
  "EXTRACTING",
  "VALIDATING",
]);

const FILE_OK = new Set(["RECEBIDO", "PROCESSANDO", "ENVIADO", "VALIDADO"]);

function isInboxDoc(metadata: Record<string, unknown> | null) {
  return metadata?.intake === "inbox";
}

async function upsertPeriodPendency(input: {
  tenantId: string;
  processId: string;
  typeCode: string;
  missing: string[];
  description: string;
}) {
  const idempotencyKey = `${input.processId}:MISSING_PERIOD:${input.typeCode}`;
  const [existing] = await db
    .select({ id: pendencies.id, status: pendencies.status })
    .from(pendencies)
    .where(
      and(
        eq(pendencies.tenantId, input.tenantId),
        eq(pendencies.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);

  if (input.missing.length === 0) {
    if (existing && existing.status === "OPEN") {
      await db
        .update(pendencies)
        .set({
          status: "RESOLVED",
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(pendencies.id, existing.id));
    }
    return;
  }

  if (existing) {
    await db
      .update(pendencies)
      .set({
        status: "OPEN",
        description: input.description,
        resolvedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(pendencies.id, existing.id));
    return;
  }

  await db.insert(pendencies).values({
    tenantId: input.tenantId,
    processId: input.processId,
    type: "MISSING_PERIOD",
    title: "Pendência de período documental",
    description: input.description,
    priority: "ALTA",
    status: "OPEN",
    idempotencyKey,
  });
}

export async function getDocumentInboxSummary(
  session: SessionPayload,
  processId: string,
) {
  const process = await loadProcessForSession(session, processId);

  const [client] = await db
    .select({
      email: clients.email,
      phone: clients.phone,
      whatsapp: clients.whatsapp,
    })
    .from(clients)
    .where(and(eq(clients.id, process.clientId), eq(clients.tenantId, session.tenantId)))
    .limit(1);

  const docRows = await db
    .select({
      document: documents,
      typeCode: documentTypes.code,
      typeName: documentTypes.name,
    })
    .from(documents)
    .innerJoin(documentTypes, eq(documentTypes.id, documents.documentTypeId))
    .where(
      and(
        eq(documents.processId, processId),
        eq(documents.tenantId, session.tenantId),
      ),
    );

  const docIds = docRows.map((row) => row.document.id);
  const runs =
    docIds.length === 0
      ? []
      : await db
          .select()
          .from(documentProcessingRuns)
          .where(
            and(
              eq(documentProcessingRuns.tenantId, session.tenantId),
              inArray(documentProcessingRuns.documentId, docIds),
            ),
          )
          .orderBy(desc(documentProcessingRuns.createdAt));

  const latestRun = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!latestRun.has(run.documentId)) latestRun.set(run.documentId, run);
  }

  const classifications =
    docIds.length === 0
      ? []
      : await db
          .select()
          .from(documentClassifications)
          .where(
            and(
              eq(documentClassifications.tenantId, session.tenantId),
              inArray(documentClassifications.documentId, docIds),
            ),
          )
          .orderBy(desc(documentClassifications.createdAt));

  const latestClass = new Map<string, (typeof classifications)[number]>();
  for (const row of classifications) {
    if (!latestClass.has(row.documentId)) latestClass.set(row.documentId, row);
  }

  const statements =
    docIds.length === 0
      ? []
      : await db
          .select()
          .from(bankStatements)
          .where(inArray(bankStatements.documentId, docIds));

  const checklist = await db
    .select({
      item: processChecklistItems,
      typeCode: documentTypes.code,
      typeName: documentTypes.name,
      typeCategory: documentTypes.category,
    })
    .from(processChecklistItems)
    .innerJoin(
      documentTypes,
      eq(documentTypes.id, processChecklistItems.documentTypeId),
    )
    .where(
      and(
        eq(processChecklistItems.processId, processId),
        eq(processChecklistItems.tenantId, session.tenantId),
      ),
    );

  const inboxDocs = docRows.filter((row) => isInboxDoc(row.document.metadata));
  let processing = 0;
  let organized = 0;
  const unidentified: Array<{
    id: string;
    originalFilename: string;
    suggestedTypeCode: string | null;
    decision: string | null;
    reason: string;
  }> = [];

  for (const row of inboxDocs) {
    const meta = (row.document.metadata ?? {}) as Record<string, unknown>;
    const run = latestRun.get(row.document.id);
    if (run && PROCESSING_RUN.has(run.status)) processing += 1;
    else if (!run) processing += 1;

    const needsReview =
      meta.intakeStatus === "needs_review" ||
      latestClass.get(row.document.id)?.decision === "LOW_CONFIDENCE" ||
      run?.status === "REQUIRES_REVIEW";

    if (row.document.checklistItemId && meta.intakeStatus === "organized") {
      organized += 1;
    } else if (needsReview || !row.document.checklistItemId) {
      if (!run || !PROCESSING_RUN.has(run.status)) {
        unidentified.push({
          id: row.document.id,
          originalFilename: row.document.originalFilename,
          suggestedTypeCode: latestClass.get(row.document.id)?.suggestedTypeCode ?? null,
          decision: latestClass.get(row.document.id)?.decision ?? null,
          reason: String(meta.reviewReason ?? "UNKNOWN_TYPE"),
        });
      }
    }
  }

  const filesByItem = new Map<string, typeof docRows>();
  for (const row of docRows) {
    if (!row.document.checklistItemId) continue;
    const list = filesByItem.get(row.document.checklistItemId) ?? [];
    list.push(row);
    filesByItem.set(row.document.checklistItemId, list);
  }

  const visual: CompletenessItem[] = [];
  let requiredOk = true;
  let expiredCount = 0;

  for (const row of checklist) {
    if (row.item.status === "NAO_APLICAVEL") continue;
    const annex = getAnnexByCode(row.typeCode);
    const files = filesByItem.get(row.item.id) ?? [];
    const expired = files.some(
      (file) =>
        file.document.status === "EXPIRADO" ||
        (file.document.validUntil && isExpiredOn(file.document.validUntil)),
    );
    const okFile = files.find(
      (file) =>
        FILE_OK.has(file.document.status) &&
        file.document.status !== "EXPIRADO" &&
        !(file.document.validUntil && isExpiredOn(file.document.validUntil)),
    );
    const ok = Boolean(okFile) && !expired;
    const required = row.item.requirement === "OBRIGATORIO";
    if (expired) expiredCount += 1;
    if (required && !ok) requiredOk = false;

    const label =
      row.item.competence &&
      (row.typeCode === "EXTRATO_BANCARIO" ||
        row.typeCode === "FATURA_CARTAO" ||
        row.typeCode === "CONTRACHEQUE")
        ? `${row.typeName} ${monthLabelPt(row.item.competence)}`
        : row.item.label.replace(/^Anexo \d+ — /, "");

    visual.push({
      code: row.typeCode,
      label,
      category: annex?.category ?? row.typeCategory,
      ok,
      warning: expired
        ? "documento fora da validade"
        : files.some((f) => f.document.status === "REJEITADO")
          ? "necessita novo documento"
          : ok
            ? null
            : "pendente",
      required,
    });
  }

  visual.push({
    code: "CADASTRO_EMAIL",
    label: "E-mail",
    category: "CADASTRO",
    ok: Boolean(client?.email),
    warning: client?.email ? null : "pendente",
    required: true,
  });
  visual.push({
    code: "CADASTRO_TELEFONE",
    label: "Telefone",
    category: "CADASTRO",
    ok: Boolean(client?.phone || client?.whatsapp),
    warning: client?.phone || client?.whatsapp ? null : "pendente",
    required: true,
  });
  if (!client?.email || !(client.phone || client.whatsapp)) requiredOk = false;

  const profile = process.incomeProfile;
  const statementsByDoc = new Map(statements.map((s) => [s.documentId, s]));
  const presentExtrato = docRows
    .filter((row) => row.typeCode === "EXTRATO_BANCARIO" && FILE_OK.has(row.document.status))
    .map((row) => {
      const st = statementsByDoc.get(row.document.id);
      return (
        competenceFromPeriod(st?.periodEnd) ??
        competenceFromPeriod(row.document.competence) ??
        null
      );
    })
    .filter((v): v is string => Boolean(v));

  const presentFatura = docRows
    .filter((row) => row.typeCode === "FATURA_CARTAO" && FILE_OK.has(row.document.status))
    .map((row) => competenceFromPeriod(row.document.competence))
    .filter((v): v is string => Boolean(v));

  const presentHolerite = docRows
    .filter((row) => row.typeCode === "CONTRACHEQUE" && FILE_OK.has(row.document.status))
    .map((row) => competenceFromPeriod(row.document.competence))
    .filter((v): v is string => Boolean(v));

  const extratoSummary =
    profile === "AUTONOMO"
      ? statementPeriodSummary({
          requiredMonths: referenceMonths(3),
          presentMonths: presentExtrato,
          typeLabel: "EXTRATOS BANCÁRIOS",
        })
      : null;
  const faturaItems = checklist.filter(
    (row) =>
      row.typeCode === "FATURA_CARTAO" && row.item.status !== "NAO_APLICAVEL",
  );
  const faturaSummary =
    profile === "AUTONOMO" && faturaItems.length > 0
      ? statementPeriodSummary({
          requiredMonths: referenceMonths(3),
          presentMonths: presentFatura,
          typeLabel: "FATURAS",
        })
      : null;
  const holeriteSummary =
    profile === "CLT"
      ? statementPeriodSummary({
          requiredMonths: referenceMonths(2),
          presentMonths: presentHolerite,
          typeLabel: "CONTRACHEQUES",
        })
      : null;

  if (extratoSummary) {
    await upsertPeriodPendency({
      tenantId: session.tenantId,
      processId,
      typeCode: "EXTRATO_BANCARIO",
      missing: extratoSummary.missing,
      description: extratoSummary.pendency ?? "",
    });
  }
  if (faturaSummary) {
    await upsertPeriodPendency({
      tenantId: session.tenantId,
      processId,
      typeCode: "FATURA_CARTAO",
      missing: faturaSummary.missing,
      description: faturaSummary.pendency ?? "",
    });
  }
  if (holeriteSummary) {
    await upsertPeriodPendency({
      tenantId: session.tenantId,
      processId,
      typeCode: "CONTRACHEQUE",
      missing: holeriteSummary.missing,
      description: holeriteSummary.pendency ?? "",
    });
  }

  const missingPeriodCount =
    (extratoSummary?.missing.length ?? 0) +
    (faturaSummary?.missing.length ?? 0) +
    (holeriteSummary?.missing.length ?? 0);

  const status = deriveDocumentationStatus({
    requiredOk,
    unidentifiedCount: unidentified.length,
    expiredCount,
    missingPeriodCount,
  });

  const firstMissing = visual.find((item) => !item.ok && item.required);
  const pendencyLine = unidentified[0]
    ? "Documento não identificado — selecione o tipo"
    : (extratoSummary?.pendency ??
      faturaSummary?.pendency ??
      holeriteSummary?.pendency ??
      (firstMissing ? `Falta ${firstMissing.label}.` : null));

  return {
    counters: {
      received: inboxDocs.length || docRows.length,
      processing,
      organized,
      pendencies: unidentified.length + missingPeriodCount + expiredCount,
    },
    unidentified,
    visual,
    lines: visualSummaryLines(visual),
    periods: {
      extratos: extratoSummary,
      faturas: faturaSummary,
      contracheques: holeriteSummary,
    },
    status,
    statusLabel:
      status === "APROVADA_PARA_ANALISE"
        ? "DOCUMENTAÇÃO APROVADA PARA ANÁLISE"
        : status === "AGUARDANDO_REVISAO"
          ? "DOCUMENTAÇÃO AGUARDANDO REVISÃO"
          : "DOCUMENTAÇÃO INCOMPLETA",
    disclaimer:
      "Não é aprovação de crédito. Significa somente que a documentação obrigatória foi recebida e validada.",
    pendency: status === "APROVADA_PARA_ANALISE" ? null : pendencyLine,
    types: await db
      .select({
        id: documentTypes.id,
        code: documentTypes.code,
        name: documentTypes.name,
      })
      .from(documentTypes)
      .where(eq(documentTypes.active, true)),
  };
}
