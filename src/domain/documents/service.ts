import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  documentTypes,
  documents,
  pendencies,
  processChecklistItems,
} from "@/db/schema";
import { loadProcessForSession } from "@/domain/access/scope";
import { writeAuditLog } from "@/domain/audit/service";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";
import { enqueueDocumentProcessing } from "@/infra/queues";
import { getStorageProvider } from "@/infra/storage";
import {
  buildStorageKey,
  validateUploadBuffer,
} from "@/domain/documents/upload-validation";
import {
  assertCanAddDocumentToChecklistItem,
  syncChecklistItemFromDocuments,
} from "@/domain/documents/upload-policy";
import { isExpiredOn } from "@/domain/documents/document-validity";
import {
  persistDocumentValidity,
  resolveUploadValidity,
} from "@/domain/documents/document-validity-store";
import { randomUUID } from "node:crypto";

export const reviewDocumentSchema = z.object({
  action: z.enum(["VALIDAR", "REJEITAR"]),
  reason: z.string().max(1000).optional().nullable(),
});

export async function listDocumentTypes() {
  return db
    .select()
    .from(documentTypes)
    .where(eq(documentTypes.active, true))
    .orderBy(asc(documentTypes.name));
}

export async function listProcessDocuments(
  session: SessionPayload,
  processId: string,
) {
  await loadProcessForSession(session, processId);

  return db
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
    )
    .orderBy(desc(documents.createdAt));
}

async function getOwnedProcess(session: SessionPayload, processId: string) {
  return loadProcessForSession(session, processId);
}

export async function uploadDocument(
  session: SessionPayload,
  input: {
    processId: string;
    checklistItemId: string;
    filename: string;
    declaredMime: string;
    buffer: Buffer;
    documentDate?: string | null;
  },
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const process = await getOwnedProcess(session, input.processId);

  const [checklistItem] = await db
    .select()
    .from(processChecklistItems)
    .where(
      and(
        eq(processChecklistItems.id, input.checklistItemId),
        eq(processChecklistItems.processId, input.processId),
        eq(processChecklistItems.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  if (!checklistItem) {
    throw new AppError(404, "Item de checklist não encontrado", "CHECKLIST_NOT_FOUND");
  }

  await assertCanAddDocumentToChecklistItem({
    tenantId: session.tenantId,
    processId: input.processId,
    checklistItem,
    lockWhenValidated: false,
  });

  const validity = await resolveUploadValidity(
    checklistItem.documentTypeId,
    input.documentDate,
  );

  const validated = await validateUploadBuffer({
    filename: input.filename,
    declaredMime: input.declaredMime,
    buffer: input.buffer,
  });

  const [duplicate] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.tenantId, session.tenantId),
        eq(documents.processId, input.processId),
        eq(documents.contentHash, validated.contentHash),
      ),
    )
    .limit(1);

  const documentId = randomUUID();
  const storageKey = buildStorageKey({
    tenantId: session.tenantId,
    processId: input.processId,
    documentId,
    extension: validated.extension,
  });

  const storage = getStorageProvider();
  await storage.putObject({
    key: storageKey,
    body: input.buffer,
    contentType: validated.mimeType,
    metadata: {
      "x-amz-meta-tenant-id": session.tenantId,
      "x-amz-meta-process-id": input.processId,
    },
  });

  const [created] = await db
    .insert(documents)
    .values({
      id: documentId,
      tenantId: session.tenantId,
      processId: input.processId,
      clientId: process.clientId,
      documentTypeId: checklistItem.documentTypeId,
      checklistItemId: checklistItem.id,
      originalFilename: validated.originalFilename,
      internalFilename: `${documentId}.${validated.extension}`,
      mimeType: validated.mimeType,
      extension: validated.extension,
      sizeBytes: validated.sizeBytes,
      contentHash: validated.contentHash,
      storageProvider: storage.name,
      storageKey,
      status: validity?.expired ? "EXPIRADO" : "RECEBIDO",
      competence: checklistItem.competence,
      documentDate: validity?.documentDate ?? null,
      validUntil: validity?.validUntil ?? null,
      rejectionReason: validity?.expired
        ? `Comprovante fora da validade de ${validity.validityDays} dias (válido até ${validity.validUntil}).`
        : null,
      uploadedByUserId: session.sub,
      duplicateOfDocumentId: duplicate?.id ?? null,
      metadata: duplicate ? { detect_duplicate: true } : {},
    })
    .returning();

  if (duplicate) {
    await db.insert(pendencies).values({
      tenantId: session.tenantId,
      processId: input.processId,
      documentId: created.id,
      checklistItemId: checklistItem.id,
      type: "DUPLICATE_DOCUMENT",
      title: "Documento duplicado",
      description: "Documento com hash idêntico a outro já enviado neste processo",
      priority: "MEDIA",
      status: "OPEN",
      idempotencyKey: `${input.processId}:${created.id}:DUPLICATE_DOCUMENT`,
      createdByUserId: session.sub,
    });
  }

  await syncChecklistItemFromDocuments(session.tenantId, checklistItem.id);

  if (validity?.expired) {
    await persistDocumentValidity({
      tenantId: session.tenantId,
      processId: input.processId,
      documentId: created.id,
      checklistItemId: checklistItem.id,
      window: validity,
      currentStatus: "EXPIRADO",
    });
  }

  // Close open pendency for this checklist item if any (staff upload → resolve)
  await db
    .update(pendencies)
    .set({
      status: "RESOLVED",
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pendencies.tenantId, session.tenantId),
        eq(pendencies.processId, input.processId),
        eq(pendencies.checklistItemId, checklistItem.id),
        inArray(pendencies.status, ["OPEN", "SUBMITTED", "REJECTED"]),
      ),
    );

  try {
    await enqueueDocumentProcessing({
      documentId: created.id,
      tenantId: session.tenantId,
      processId: input.processId,
      correlationId: meta?.correlationId,
    });
  } catch {
    // Queue may be unavailable in early boot; document remains RECEBIDO
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "UPLOAD",
    entity: "document",
    entityId: created.id,
    newValue: {
      processId: input.processId,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes,
      contentHash: validated.contentHash,
      status: "RECEBIDO",
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return created;
}

export async function getDocumentForTenant(
  session: SessionPayload,
  documentId: string,
) {
  const [row] = await db
    .select({
      document: documents,
      typeCode: documentTypes.code,
      typeName: documentTypes.name,
    })
    .from(documents)
    .innerJoin(documentTypes, eq(documentTypes.id, documents.documentTypeId))
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  if (!row) throw new AppError(404, "Documento não encontrado", "DOCUMENT_NOT_FOUND");
  await loadProcessForSession(session, row.document.processId);
  return row;
}

function documentContentPath(documentId: string) {
  return `/api/v1/documents/${documentId}/content`;
}

function usePresignedPublicUrls() {
  return Boolean(process.env.MINIO_PUBLIC_ENDPOINT?.trim());
}

export async function streamDocumentContent(
  session: SessionPayload,
  documentId: string,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const { document } = await getDocumentForTenant(session, documentId);
  const storage = getStorageProvider();
  const body = await storage.getObject(document.storageKey);

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "VIEW",
    entity: "document",
    entityId: documentId,
    newValue: { mode: "proxy" },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return {
    body,
    mimeType: document.mimeType,
    filename: document.originalFilename,
  };
}

export async function createDocumentViewUrl(
  session: SessionPayload,
  documentId: string,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const { document } = await getDocumentForTenant(session, documentId);

  if (!usePresignedPublicUrls()) {
    return {
      url: documentContentPath(documentId),
      mode: "proxy" as const,
      mimeType: document.mimeType,
    };
  }

  const storage = getStorageProvider();
  const url = await storage.getSignedUrl({
    key: document.storageKey,
    expiresInSeconds: 120,
    method: "GET",
  });

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "VIEW",
    entity: "document",
    entityId: documentId,
    newValue: { mode: "presigned", expiresInSeconds: 120 },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return {
    url,
    mode: "presigned" as const,
    expiresInSeconds: 120,
    mimeType: document.mimeType,
  };
}

export async function reviewDocument(
  session: SessionPayload,
  documentId: string,
  input: z.infer<typeof reviewDocumentSchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const { document } = await getDocumentForTenant(session, documentId);

  if (input.action === "REJEITAR" && !input.reason?.trim()) {
    throw new AppError(400, "Informe o motivo da rejeição", "REJECTION_REASON_REQUIRED");
  }

  if (input.action === "VALIDAR") {
    const expired =
      document.status === "EXPIRADO" ||
      (document.validUntil ? isExpiredOn(document.validUntil) : false);
    if (expired) {
      throw new AppError(
        400,
        "Não é possível validar um comprovante fora da validade de 60 dias. Solicite um documento atualizado.",
        "DOCUMENT_EXPIRED",
      );
    }
  }

  const nextStatus = input.action === "VALIDAR" ? "VALIDADO" : "REJEITADO";

  const [updated] = await db
    .update(documents)
    .set({
      status: nextStatus,
      rejectionReason: input.action === "REJEITAR" ? input.reason : null,
      validatedByUserId: session.sub,
      validatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(documents.id, documentId), eq(documents.tenantId, session.tenantId)),
    )
    .returning();

  if (document.checklistItemId) {
    await syncChecklistItemFromDocuments(
      session.tenantId,
      document.checklistItemId,
    );
  }

  if (input.action === "REJEITAR") {
    await db.insert(pendencies).values({
      tenantId: session.tenantId,
      processId: document.processId,
      documentId: document.id,
      checklistItemId: document.checklistItemId,
      type: "DOCUMENTO_REJEITADO",
      title: "Documento rejeitado",
      description:
        input.reason?.trim() ||
        "Documento rejeitado — necessário reenvio",
      priority: "ALTA",
      status: "OPEN",
      createdByUserId: session.sub,
    });
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: input.action === "VALIDAR" ? "VALIDATE" : "REJECT",
    entity: "document",
    entityId: documentId,
    oldValue: { status: document.status },
    newValue: { status: nextStatus, reason: input.reason ?? null },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return updated;
}
