import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { documentTypes, documents, processChecklistItems } from "@/db/schema";
import { AppError } from "@/lib/api";
import { deriveChecklistStatusFromDocuments } from "./checklist-status";

export async function assertCanAddDocumentToChecklistItem(input: {
  tenantId: string;
  processId: string;
  checklistItem: {
    id: string;
    status: string;
    documentTypeId: string;
  };
  lockWhenValidated: boolean;
}) {
  if (input.checklistItem.status === "NAO_APLICAVEL") {
    throw new AppError(400, "Item marcado como não aplicável", "NOT_APPLICABLE");
  }
  if (input.lockWhenValidated && input.checklistItem.status === "VALIDADO") {
    throw new AppError(400, "Documento já validado", "ALREADY_VALIDATED");
  }

  const [type] = await db
    .select({ allowsMultiple: documentTypes.allowsMultiple })
    .from(documentTypes)
    .where(eq(documentTypes.id, input.checklistItem.documentTypeId))
    .limit(1);

  const allowsMultiple = type?.allowsMultiple ?? false;
  if (allowsMultiple) return { allowsMultiple };

  const [blocking] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, input.tenantId),
        eq(documents.processId, input.processId),
        eq(documents.checklistItemId, input.checklistItem.id),
        inArray(documents.status, [
          "PENDENTE",
          "RECEBIDO",
          "PROCESSANDO",
          "VALIDADO",
        ]),
      ),
    )
    .limit(1);

  if (blocking) {
    throw new AppError(
      400,
      "Este anexo aceita apenas um arquivo. Reenvie somente se o anterior foi rejeitado.",
      "SINGLE_FILE_ANNEX",
    );
  }

  return { allowsMultiple: false };
}

export async function syncChecklistItemFromDocuments(
  tenantId: string,
  checklistItemId: string,
) {
  const files = await db
    .select({
      id: documents.id,
      status: documents.status,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, tenantId),
        eq(documents.checklistItemId, checklistItemId),
      ),
    )
    .orderBy(asc(documents.createdAt));

  const nextStatus = deriveChecklistStatusFromDocuments(
    files.map((file) => file.status),
  );
  const active = files.filter(
    (file) => file.status !== "REJEITADO" && file.status !== "EXPIRADO",
  );
  const pointer = (active.at(-1) ?? files.at(-1))?.id ?? null;

  const [updated] = await db
    .update(processChecklistItems)
    .set({
      status: nextStatus,
      documentId: pointer,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(processChecklistItems.id, checklistItemId),
        eq(processChecklistItems.tenantId, tenantId),
      ),
    )
    .returning();

  return updated;
}
