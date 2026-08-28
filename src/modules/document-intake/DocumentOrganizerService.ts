import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  bankStatements,
  documentClassifications,
  documentExtractedFields,
  documentTypes,
  documents,
  processChecklistItems,
} from "@/db/schema";
import { writeAuditLog } from "@/domain/audit/service";
import { syncChecklistItemFromDocuments } from "@/domain/documents/upload-policy";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";
import { decideOrganizeAction, mergeIntakeMetadata } from "./organize-rules";
import { competenceFromPeriod } from "./periods";

const COMPETENCE_TYPES = new Set([
  "EXTRATO_BANCARIO",
  "FATURA_CARTAO",
  "CONTRACHEQUE",
]);

function fieldMap(
  fields: Array<{ field: string; value: string | null; normalizedValue: string | null }>,
) {
  const map = new Map<string, string>();
  for (const field of fields) {
    const value = field.normalizedValue ?? field.value;
    if (value) map.set(field.field.toLowerCase(), value);
  }
  return map;
}

async function resolveCompetence(input: {
  tenantId: string;
  documentId: string;
  typeCode: string;
}): Promise<string | null> {
  if (!COMPETENCE_TYPES.has(input.typeCode)) return null;

  const [statement] = await db
    .select({
      periodEnd: bankStatements.periodEnd,
      periodStart: bankStatements.periodStart,
    })
    .from(bankStatements)
    .where(eq(bankStatements.documentId, input.documentId))
    .orderBy(desc(bankStatements.createdAt))
    .limit(1);

  const fromStatement =
    competenceFromPeriod(statement?.periodEnd) ??
    competenceFromPeriod(statement?.periodStart);
  if (fromStatement) return fromStatement;

  const fields = await db
    .select({
      field: documentExtractedFields.field,
      value: documentExtractedFields.value,
      normalizedValue: documentExtractedFields.normalizedValue,
    })
    .from(documentExtractedFields)
    .where(
      and(
        eq(documentExtractedFields.documentId, input.documentId),
        eq(documentExtractedFields.tenantId, input.tenantId),
      ),
    );

  const map = fieldMap(fields);
  return (
    competenceFromPeriod(map.get("period_end")) ??
    competenceFromPeriod(map.get("periodend")) ??
    competenceFromPeriod(map.get("competence")) ??
    competenceFromPeriod(map.get("mes_referencia")) ??
    competenceFromPeriod(map.get("reference_month")) ??
    null
  );
}

async function findOrCreateChecklistItem(input: {
  tenantId: string;
  processId: string;
  documentTypeId: string;
  typeCode: string;
  typeName: string;
  competence: string | null;
}) {
  const existing = await db
    .select()
    .from(processChecklistItems)
    .where(
      and(
        eq(processChecklistItems.tenantId, input.tenantId),
        eq(processChecklistItems.processId, input.processId),
        eq(processChecklistItems.documentTypeId, input.documentTypeId),
      ),
    );

  const live = existing.filter((row) => row.status !== "NAO_APLICAVEL");
  if (input.competence) {
    const match = live.find((row) => row.competence === input.competence);
    if (match) return match;
    const [created] = await db
      .insert(processChecklistItems)
      .values({
        tenantId: input.tenantId,
        processId: input.processId,
        documentTypeId: input.documentTypeId,
        label: `${input.typeName} — ${input.competence}`,
        requirement: "OBRIGATORIO",
        status: "PENDENTE",
        sortOrder: 250,
        competence: input.competence,
      })
      .returning();
    return created;
  }

  const primary =
    live.find((row) => !row.competence) ?? live[0] ?? existing[0];
  if (primary) return primary;

  const [created] = await db
    .insert(processChecklistItems)
    .values({
      tenantId: input.tenantId,
      processId: input.processId,
      documentTypeId: input.documentTypeId,
      label: input.typeName,
      requirement: "OBRIGATORIO",
      status: "PENDENTE",
      sortOrder: 240,
    })
    .returning();
  return created;
}

async function markNeedsReview(input: {
  documentId: string;
  tenantId: string;
  metadata: Record<string, unknown> | null;
  reason: string;
}) {
  await db
    .update(documents)
    .set({
      metadata: mergeIntakeMetadata(input.metadata, {
        intakeStatus: "needs_review",
        reviewReason: input.reason,
      }),
      updatedAt: new Date(),
    })
    .where(
      and(eq(documents.id, input.documentId), eq(documents.tenantId, input.tenantId)),
    );
}

export async function organizeDocumentAfterProcessing(input: {
  documentId: string;
  tenantId: string;
  processId: string;
  humanSelectedTypeCode?: string;
}) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(
      and(eq(documents.id, input.documentId), eq(documents.tenantId, input.tenantId)),
    )
    .limit(1);
  if (!doc) return null;

  const intake = (doc.metadata ?? {}) as Record<string, unknown>;
  const isInbox = intake.intake === "inbox" || !doc.checklistItemId;
  if (!isInbox && !input.humanSelectedTypeCode) return doc;

  const [classification] = await db
    .select()
    .from(documentClassifications)
    .where(
      and(
        eq(documentClassifications.documentId, input.documentId),
        eq(documentClassifications.tenantId, input.tenantId),
      ),
    )
    .orderBy(desc(documentClassifications.createdAt))
    .limit(1);

  let matchedTypeCode: string | null = null;
  if (classification?.matchedDocumentTypeId) {
    const [type] = await db
      .select({ code: documentTypes.code })
      .from(documentTypes)
      .where(eq(documentTypes.id, classification.matchedDocumentTypeId))
      .limit(1);
    matchedTypeCode = type?.code ?? null;
  } else if (classification?.suggestedTypeCode) {
    const [type] = await db
      .select({ code: documentTypes.code })
      .from(documentTypes)
      .where(eq(documentTypes.code, classification.suggestedTypeCode))
      .limit(1);
    matchedTypeCode = type?.code ?? null;
  }

  const decision = decideOrganizeAction({
    decision: classification?.decision ?? null,
    matchedTypeCode,
    humanSelectedTypeCode: input.humanSelectedTypeCode ?? null,
  });

  if (decision.action === "review") {
    await markNeedsReview({
      documentId: input.documentId,
      tenantId: input.tenantId,
      metadata: doc.metadata,
      reason: decision.reason,
    });
    return doc;
  }

  const [type] = await db
    .select()
    .from(documentTypes)
    .where(eq(documentTypes.code, decision.typeCode))
    .limit(1);
  if (!type) {
    await markNeedsReview({
      documentId: input.documentId,
      tenantId: input.tenantId,
      metadata: doc.metadata,
      reason: "UNKNOWN_TYPE",
    });
    return doc;
  }

  const competence = await resolveCompetence({
    tenantId: input.tenantId,
    documentId: input.documentId,
    typeCode: type.code,
  });

  if (COMPETENCE_TYPES.has(type.code) && !competence && !input.humanSelectedTypeCode) {
    await markNeedsReview({
      documentId: input.documentId,
      tenantId: input.tenantId,
      metadata: doc.metadata,
      reason: "REQUIRES_REVIEW",
    });
    return doc;
  }

  const item = await findOrCreateChecklistItem({
    tenantId: input.tenantId,
    processId: input.processId,
    documentTypeId: type.id,
    typeCode: type.code,
    typeName: type.name,
    competence,
  });

  await db
    .update(documents)
    .set({
      documentTypeId: type.id,
      checklistItemId: item.id,
      competence: competence ?? item.competence,
      metadata: mergeIntakeMetadata(doc.metadata, {
        intakeStatus: "organized",
        organizedTypeCode: type.code,
      }),
      updatedAt: new Date(),
    })
    .where(eq(documents.id, input.documentId));

  await syncChecklistItemFromDocuments(input.tenantId, item.id);

  await writeAuditLog({
    tenantId: input.tenantId,
    action: "DOCUMENT_ORGANIZED",
    entity: "document",
    entityId: input.documentId,
    newValue: {
      typeCode: type.code,
      checklistItemId: item.id,
      competence,
      auto: !input.humanSelectedTypeCode,
    },
  });

  return doc;
}

export async function assignInboxDocumentType(
  session: SessionPayload,
  processId: string,
  documentId: string,
  documentTypeCode: string,
  meta?: { correlationId?: string },
) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.processId, processId),
        eq(documents.tenantId, session.tenantId),
      ),
    )
    .limit(1);
  if (!doc) throw new AppError(404, "Documento não encontrado", "DOCUMENT_NOT_FOUND");

  const [type] = await db
    .select({ code: documentTypes.code })
    .from(documentTypes)
    .where(eq(documentTypes.code, documentTypeCode))
    .limit(1);
  if (!type) throw new AppError(400, "Tipo de documento inválido", "INVALID_TYPE");

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "DOCUMENT_TYPE_ASSIGNED",
    entity: "document",
    entityId: documentId,
    newValue: { documentTypeCode },
    correlationId: meta?.correlationId,
  });

  return organizeDocumentAfterProcessing({
    documentId,
    tenantId: session.tenantId,
    processId,
    humanSelectedTypeCode: documentTypeCode,
  });
}
