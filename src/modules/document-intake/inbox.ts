import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentTypes, documents, pendencies } from "@/db/schema";
import { loadProcessForSession } from "@/domain/access/scope";
import { writeAuditLog } from "@/domain/audit/service";
import {
  buildStorageKey,
  validateUploadBuffer,
} from "@/domain/documents/upload-validation";
import { enqueueDocumentProcessing } from "@/infra/queues";
import { getStorageProvider } from "@/infra/storage";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";
import { mergeIntakeMetadata } from "./organize-rules";

const INBOX_PLACEHOLDER_CODE = "OUTROS_DOCUMENTOS";

async function resolvePlaceholderTypeId() {
  const [type] = await db
    .select({ id: documentTypes.id })
    .from(documentTypes)
    .where(eq(documentTypes.code, INBOX_PLACEHOLDER_CODE))
    .limit(1);
  if (!type) {
    throw new AppError(
      500,
      "Tipo OUTROS_DOCUMENTOS não encontrado no catálogo",
      "INTAKE_TYPE_MISSING",
    );
  }
  return type.id;
}

export async function uploadInboxDocuments(
  session: SessionPayload,
  processId: string,
  files: Array<{
    filename: string;
    declaredMime: string;
    buffer: Buffer;
  }>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  if (files.length === 0) {
    throw new AppError(400, "Envie ao menos um arquivo", "FILES_REQUIRED");
  }
  if (files.length > 40) {
    throw new AppError(400, "Máximo de 40 arquivos por lote", "BATCH_TOO_LARGE");
  }

  const process = await loadProcessForSession(session, processId);
  const placeholderTypeId = await resolvePlaceholderTypeId();
  const storage = getStorageProvider();
  const created = [];

  for (const file of files) {
    const validated = await validateUploadBuffer(file);
    const [duplicate] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.tenantId, session.tenantId),
          eq(documents.processId, processId),
          eq(documents.contentHash, validated.contentHash),
        ),
      )
      .limit(1);

    const documentId = randomUUID();
    const storageKey = buildStorageKey({
      tenantId: session.tenantId,
      processId,
      documentId,
      extension: validated.extension,
    });

    await storage.putObject({
      key: storageKey,
      body: file.buffer,
      contentType: validated.mimeType,
      metadata: {
        "x-amz-meta-tenant-id": session.tenantId,
        "x-amz-meta-process-id": processId,
      },
    });

    const [row] = await db
      .insert(documents)
      .values({
        id: documentId,
        tenantId: session.tenantId,
        processId,
        clientId: process.clientId,
        documentTypeId: placeholderTypeId,
        checklistItemId: null,
        originalFilename: validated.originalFilename,
        internalFilename: `${documentId}.${validated.extension}`,
        mimeType: validated.mimeType,
        extension: validated.extension,
        sizeBytes: validated.sizeBytes,
        contentHash: validated.contentHash,
        storageProvider: storage.name,
        storageKey,
        status: "RECEBIDO",
        uploadedByUserId: session.sub,
        duplicateOfDocumentId: duplicate?.id ?? null,
        metadata: mergeIntakeMetadata(
          duplicate ? { detect_duplicate: true } : {},
          { intakeStatus: "received" },
        ),
      })
      .returning();

    if (duplicate) {
      await db.insert(pendencies).values({
        tenantId: session.tenantId,
        processId,
        documentId: row.id,
        type: "DUPLICATE_DOCUMENT",
        title: "Documento duplicado",
        description:
          "Documento com hash idêntico a outro já enviado neste processo",
        priority: "MEDIA",
        status: "OPEN",
        idempotencyKey: `${processId}:${row.id}:DUPLICATE_DOCUMENT`,
        createdByUserId: session.sub,
      });
    }

    try {
      await enqueueDocumentProcessing({
        documentId: row.id,
        tenantId: session.tenantId,
        processId,
        correlationId: meta?.correlationId,
      });
    } catch {
      // Queue may be unavailable; document remains RECEBIDO
    }

    await writeAuditLog({
      tenantId: session.tenantId,
      userId: session.sub,
      action: "UPLOAD",
      entity: "document",
      entityId: row.id,
      newValue: {
        processId,
        intake: "inbox",
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        contentHash: validated.contentHash,
        checklistItemId: null,
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    created.push(row);
  }

  return { items: created, count: created.length };
}
