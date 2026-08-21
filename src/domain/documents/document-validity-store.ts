import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentTypes, documents, pendencies } from "@/db/schema";
import { AppError } from "@/lib/api";
import { getAnnexByCode } from "./caixa-annex-catalog";
import {
  computeValidityWindow,
  extractDocumentDateFromFields,
  type ValidityWindow,
} from "./document-validity";
import { syncChecklistItemFromDocuments } from "./upload-policy";

export async function resolveUploadValidity(
  documentTypeId: string,
  documentDate?: string | null,
) {
  const [type] = await db
    .select({ code: documentTypes.code })
    .from(documentTypes)
    .where(eq(documentTypes.id, documentTypeId))
    .limit(1);
  const validityDays = getAnnexByCode(type?.code ?? "")?.validityDays ?? null;
  if (!validityDays) return null;
  if (!documentDate?.trim()) {
    throw new AppError(
      400,
      `Informe a data do comprovante (validade de ${validityDays} dias).`,
      "DOCUMENT_DATE_REQUIRED",
    );
  }
  return computeValidityWindow({ documentDate, validityDays });
}

export async function persistDocumentValidity(input: {
  tenantId: string;
  processId: string;
  documentId: string;
  checklistItemId: string | null;
  window: ValidityWindow;
  currentStatus: string;
}) {
  const nextStatus = input.window.expired
    ? "EXPIRADO"
    : input.currentStatus === "EXPIRADO"
      ? "RECEBIDO"
      : input.currentStatus;

  await db
    .update(documents)
    .set({
      documentDate: input.window.documentDate,
      validUntil: input.window.validUntil,
      status: nextStatus as typeof documents.$inferInsert.status,
      rejectionReason: input.window.expired
        ? `Comprovante fora da validade de ${input.window.validityDays} dias (válido até ${input.window.validUntil}).`
        : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documents.id, input.documentId),
        eq(documents.tenantId, input.tenantId),
      ),
    );

  if (input.window.expired) {
    const idempotencyKey = `${input.processId}:${input.documentId}:DOCUMENTO_VENCIDO`;
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
    if (!existing) {
      await db.insert(pendencies).values({
        tenantId: input.tenantId,
        processId: input.processId,
        documentId: input.documentId,
        checklistItemId: input.checklistItemId,
        type: "DOCUMENTO_VENCIDO",
        title: "Comprovante de endereço vencido",
        description: `O comprovante está fora do prazo de ${input.window.validityDays} dias exigido pela Caixa. Data do documento: ${input.window.documentDate}. Válido até ${input.window.validUntil}. Envie um comprovante atualizado.`,
        priority: "ALTA",
        status: "OPEN",
        idempotencyKey,
      });
    }
  }

  if (input.checklistItemId) {
    await syncChecklistItemFromDocuments(input.tenantId, input.checklistItemId);
  }

  return { ...input.window, status: nextStatus };
}

export async function applyExtractedDocumentValidity(input: {
  tenantId: string;
  processId: string;
  documentId: string;
  checklistItemId: string | null;
  typeCode: string;
  fields: Array<{ field: string; value: string | null }>;
}) {
  const annex = getAnnexByCode(input.typeCode);
  if (!annex?.validityDays) return null;

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
  if (!doc || doc.status === "VALIDADO") return null;

  const documentDate =
    extractDocumentDateFromFields(input.fields) ?? doc.documentDate;
  if (!documentDate) {
    const idempotencyKey = `${input.processId}:${input.documentId}:DOCUMENTO_SEM_DATA`;
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
    if (!existing) {
      await db.insert(pendencies).values({
        tenantId: input.tenantId,
        processId: input.processId,
        documentId: input.documentId,
        checklistItemId: input.checklistItemId,
        type: "DOCUMENTO_SEM_DATA",
        title: "Data do comprovante não identificada",
        description:
          "Não foi possível confirmar a data do comprovante de endereço. Informe a data do documento para validar o prazo de 60 dias.",
        priority: "ALTA",
        status: "OPEN",
        idempotencyKey,
      });
    }
    return null;
  }

  try {
    const window = computeValidityWindow({
      documentDate,
      validityDays: annex.validityDays,
    });
    return persistDocumentValidity({
      tenantId: input.tenantId,
      processId: input.processId,
      documentId: input.documentId,
      checklistItemId: input.checklistItemId,
      window,
      currentStatus: doc.status,
    });
  } catch {
    return null;
  }
}
