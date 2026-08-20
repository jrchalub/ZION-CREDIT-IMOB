import { and, asc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import {
  clients,
  documentTypes,
  documents,
  financingProcesses,
  pendencies,
  processChecklistItems,
} from "@/db/schema";
import { writeAuditLog } from "@/domain/audit/service";
import {
  buildStorageKey,
  validateUploadBuffer,
} from "@/domain/documents/upload-validation";
import { AppError } from "@/lib/api";
import { enqueueDocumentProcessing } from "@/infra/queues";
import { getStorageProvider } from "@/infra/storage";
import {
  toOperationalStage,
  type OperationalStage,
} from "../workflow/operational-stages";
import type { ProcessStatus } from "@/domain/process/status-machine";
import { resolvePortalAccess } from "./PortalAccessService";
import type { PortalTokenRecord } from "./token-crypto";
import { markPendencySubmitted } from "@/domain/pendencies/service";
import { OPEN_PENDENCY_STATUSES } from "../pendencies/pendency-machine";

const CLIENT_STATUS_COPY: Record<OperationalStage, string> = {
  NOVO: "Seu cadastro foi iniciado.",
  CADASTRO_INCOMPLETO: "Complete as informações solicitadas.",
  AGUARDANDO_DOCUMENTOS: "Estamos aguardando sua documentação.",
  DOCUMENTACAO_EM_ANALISE: "Sua documentação está em análise.",
  PENDENCIA: "Há pendências no seu financiamento.",
  ANALISE_FINANCEIRA: "Seu financiamento está em análise.",
  DOSSIE_PRONTO: "Seu financiamento está em análise.",
  EM_ANALISE: "Seu financiamento está em análise.",
  PARECER: "Seu financiamento está em análise.",
  ENVIADO_PARA_INSTITUICAO: "Seu processo foi enviado à instituição financeira.",
  EM_AVALIACAO: "A instituição financeira está avaliando seu processo.",
  APROVADO: "Há uma atualização institucional no seu processo.",
  CONTRATACAO: "Seu processo está em fase de contratação.",
  REPROVADO: "Há uma atualização institucional no seu processo.",
  CANCELADO: "Este processo foi encerrado.",
};

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export async function getClientPortalView(rawToken: string) {
  const access = await resolvePortalAccess(rawToken);
  return buildClientPortalView(access);
}

async function buildClientPortalView(access: PortalTokenRecord) {
  const [row] = await db
    .select({
      process: financingProcesses,
      clientName: clients.fullName,
    })
    .from(financingProcesses)
    .innerJoin(clients, eq(clients.id, financingProcesses.clientId))
    .where(
      and(
        eq(financingProcesses.id, access.processId),
        eq(financingProcesses.tenantId, access.tenantId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new AppError(404, "Processo não encontrado", "PROCESS_NOT_FOUND");
  }

  const checklist = await db
    .select({
      item: processChecklistItems,
      typeName: documentTypes.name,
      typeCode: documentTypes.code,
    })
    .from(processChecklistItems)
    .innerJoin(
      documentTypes,
      eq(documentTypes.id, processChecklistItems.documentTypeId),
    )
    .where(
      and(
        eq(processChecklistItems.processId, access.processId),
        eq(processChecklistItems.tenantId, access.tenantId),
      ),
    )
    .orderBy(asc(processChecklistItems.sortOrder));

  const applicable = checklist.filter((c) => c.item.status !== "NAO_APLICAVEL");
  const done = applicable.filter(
    (c) => c.item.status === "VALIDADO" || c.item.status === "ENVIADO",
  );
  const percent =
    applicable.length === 0
      ? 0
      : Math.round((done.length / applicable.length) * 100);

  const openPendencies = await db
    .select({
      id: pendencies.id,
      type: pendencies.type,
      title: pendencies.title,
      description: pendencies.description,
      priority: pendencies.priority,
      status: pendencies.status,
      checklistItemId: pendencies.checklistItemId,
      dueAt: pendencies.dueAt,
    })
    .from(pendencies)
    .where(
      and(
        eq(pendencies.processId, access.processId),
        eq(pendencies.tenantId, access.tenantId),
        inArray(pendencies.status, [...OPEN_PENDENCY_STATUSES]),
      ),
    );

  const stage = toOperationalStage(row.process.status as ProcessStatus);

  await writeAuditLog({
    tenantId: access.tenantId,
    userId: null,
    action: "PORTAL_VIEW",
    entity: "portal_access_token",
    entityId: access.id,
    newValue: { processId: access.processId },
  });

  return {
    greetingName: firstName(row.clientName),
    processNumber: row.process.processNumber,
    statusMessage: CLIENT_STATUS_COPY[stage],
    progressPercent: percent,
    documents: applicable.map((c) => ({
      checklistItemId: c.item.id,
      label: c.item.label,
      typeName: c.typeName,
      status: c.item.status,
      needsUpload:
        c.item.status === "PENDENTE" || c.item.status === "REJEITADO",
      canUpload:
        c.item.status === "PENDENTE" ||
        c.item.status === "REJEITADO" ||
        c.item.status === "ENVIADO",
    })),
    pendencies: openPendencies.map((p) => ({
      id: p.id,
      type: p.type,
      title: p.title ?? p.type,
      description: p.description,
      priority: p.priority,
      status: p.status,
      checklistItemId: p.checklistItemId,
      dueAt: p.dueAt,
    })),
    access: {
      tokenId: access.id,
      expiresAt: access.expiresAt,
    },
  };
}

export async function uploadViaPortal(
  rawToken: string,
  input: {
    checklistItemId: string;
    filename: string;
    declaredMime: string;
    buffer: Buffer;
  },
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const access = await resolvePortalAccess(rawToken);

  const [process] = await db
    .select()
    .from(financingProcesses)
    .where(
      and(
        eq(financingProcesses.id, access.processId),
        eq(financingProcesses.tenantId, access.tenantId),
      ),
    )
    .limit(1);

  if (!process) {
    throw new AppError(404, "Processo não encontrado", "PROCESS_NOT_FOUND");
  }

  const [checklistItem] = await db
    .select()
    .from(processChecklistItems)
    .where(
      and(
        eq(processChecklistItems.id, input.checklistItemId),
        eq(processChecklistItems.processId, access.processId),
        eq(processChecklistItems.tenantId, access.tenantId),
      ),
    )
    .limit(1);

  if (!checklistItem) {
    throw new AppError(404, "Item não encontrado", "CHECKLIST_NOT_FOUND");
  }
  if (checklistItem.status === "NAO_APLICAVEL") {
    throw new AppError(400, "Item não aplicável", "NOT_APPLICABLE");
  }
  if (checklistItem.status === "VALIDADO") {
    throw new AppError(400, "Documento já validado", "ALREADY_VALIDATED");
  }

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
        eq(documents.tenantId, access.tenantId),
        eq(documents.processId, access.processId),
        eq(documents.contentHash, validated.contentHash),
      ),
    )
    .limit(1);

  const documentId = randomUUID();
  const storageKey = buildStorageKey({
    tenantId: access.tenantId,
    processId: access.processId,
    documentId,
    extension: validated.extension,
  });

  const storage = getStorageProvider();
  await storage.putObject({
    key: storageKey,
    body: input.buffer,
    contentType: validated.mimeType,
    metadata: {
      "x-amz-meta-tenant-id": access.tenantId,
      "x-amz-meta-process-id": access.processId,
      "x-amz-meta-portal-token-id": access.id,
    },
  });

  const [created] = await db
    .insert(documents)
    .values({
      id: documentId,
      tenantId: access.tenantId,
      processId: access.processId,
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
      status: "RECEBIDO",
      competence: checklistItem.competence,
      uploadedByUserId: null,
      duplicateOfDocumentId: duplicate?.id ?? null,
      metadata: {
        source: "client_portal",
        portalTokenId: access.id,
        ...(duplicate ? { detect_duplicate: true } : {}),
      },
    })
    .returning();

  await db
    .update(processChecklistItems)
    .set({
      status: "ENVIADO",
      documentId: created.id,
      updatedAt: new Date(),
    })
    .where(eq(processChecklistItems.id, checklistItem.id));

  await markPendencySubmitted({
    tenantId: access.tenantId,
    processId: access.processId,
    checklistItemId: checklistItem.id,
    documentId: created.id,
    portalTokenId: access.id,
    meta,
  });

  try {
    await enqueueDocumentProcessing({
      documentId: created.id,
      tenantId: access.tenantId,
      processId: access.processId,
      correlationId: meta?.correlationId,
    });
  } catch {
    // Queue optional
  }

  await writeAuditLog({
    tenantId: access.tenantId,
    userId: null,
    action: "PORTAL_UPLOAD",
    entity: "document",
    entityId: created.id,
    newValue: {
      processId: access.processId,
      portalTokenId: access.id,
      checklistItemId: checklistItem.id,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes,
      contentHash: validated.contentHash,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return { documentId: created.id, checklistItemId: checklistItem.id };
}

export async function respondPendencyViaPortal(
  rawToken: string,
  pendencyId: string,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const access = await resolvePortalAccess(rawToken);

  const [current] = await db
    .select()
    .from(pendencies)
    .where(
      and(
        eq(pendencies.id, pendencyId),
        eq(pendencies.processId, access.processId),
        eq(pendencies.tenantId, access.tenantId),
      ),
    )
    .limit(1);

  if (!current) {
    throw new AppError(404, "Pendência não encontrada", "PENDENCY_NOT_FOUND");
  }

  if (
    current.status !== "OPEN" &&
    current.status !== "REJECTED" &&
    current.status !== "SUBMITTED"
  ) {
    throw new AppError(400, "Pendência não pode ser respondida", "PENDENCY_CLOSED");
  }

  const ids = await markPendencySubmitted({
    tenantId: access.tenantId,
    processId: access.processId,
    pendencyId,
    portalTokenId: access.id,
    meta,
  });

  if (ids.length === 0 && current.status !== "SUBMITTED") {
    throw new AppError(400, "Não foi possível responder a pendência", "PENDENCY_SUBMIT_FAILED");
  }

  const [updated] = await db
    .select()
    .from(pendencies)
    .where(eq(pendencies.id, pendencyId))
    .limit(1);

  return updated;
}
