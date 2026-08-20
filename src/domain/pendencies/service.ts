import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, financingProcesses, pendencies } from "@/db/schema";
import { loadProcessForSession } from "@/domain/access/scope";
import { writeAuditLog } from "@/domain/audit/service";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";
import { hasPermission } from "@/domain/rbac/permissions";
import {
  buildPendencyPortalMessage,
  notify,
} from "@/modules/operations/notifications/NotificationService";
import {
  assertPendencyTransition,
  OPEN_PENDENCY_STATUSES,
  PENDENCY_STATUS_LABELS,
  type PendencyStatus,
} from "@/modules/operations/pendencies/pendency-machine";
import { issuePortalAccessForNotify } from "@/modules/operations/portal/PortalAccessService";
import { normalizeWhatsAppRecipient } from "@/modules/operations/portal/deep-link";

export const createPendencySchema = z.object({
  processId: z.uuid(),
  type: z.string().min(2).max(80),
  title: z.string().min(2).max(200).optional(),
  description: z.string().min(3).max(2000),
  priority: z.enum(["BAIXA", "MEDIA", "ALTA", "CRITICA"]).default("MEDIA"),
  documentId: z.uuid().optional().nullable(),
  checklistItemId: z.uuid().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  idempotencyKey: z.string().min(3).max(200).optional().nullable(),
  notifyClient: z.boolean().optional().default(true),
});

export const updatePendencySchema = z.object({
  status: z.enum([
    "OPEN",
    "SUBMITTED",
    "UNDER_REVIEW",
    "RESOLVED",
    "REJECTED",
    "CANCELLED",
  ]),
  description: z.string().min(3).max(2000).optional(),
  reviewNote: z.string().max(2000).optional().nullable(),
  responseNote: z.string().max(2000).optional().nullable(),
});

export async function listPendencies(
  session: SessionPayload,
  processId: string,
) {
  await loadProcessForSession(session, processId);

  return db
    .select()
    .from(pendencies)
    .where(
      and(
        eq(pendencies.processId, processId),
        eq(pendencies.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(pendencies.createdAt));
}

/**
 * Analyst creates self-service pendency (OPEN) + optional client notification.
 */
export async function createPendency(
  session: SessionPayload,
  input: z.infer<typeof createPendencySchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const process = await loadProcessForSession(session, input.processId);
  const title = (input.title?.trim() || input.type).slice(0, 200);

  if (input.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(pendencies)
      .where(
        and(
          eq(pendencies.tenantId, session.tenantId),
          eq(pendencies.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing) return existing;
  }

  // Prevent duplicate open pendency for same checklist item + type
  if (input.checklistItemId) {
    const [dup] = await db
      .select({ id: pendencies.id })
      .from(pendencies)
      .where(
        and(
          eq(pendencies.tenantId, session.tenantId),
          eq(pendencies.processId, input.processId),
          eq(pendencies.checklistItemId, input.checklistItemId),
          eq(pendencies.type, input.type),
          inArray(pendencies.status, [...OPEN_PENDENCY_STATUSES]),
        ),
      )
      .limit(1);
    if (dup) {
      throw new AppError(
        409,
        "Já existe pendência aberta deste tipo para o item",
        "PENDENCY_DUPLICATE",
      );
    }
  }

  const [created] = await db
    .insert(pendencies)
    .values({
      tenantId: session.tenantId,
      processId: input.processId,
      type: input.type,
      title,
      description: input.description,
      priority: input.priority,
      status: "OPEN",
      documentId: input.documentId ?? null,
      checklistItemId: input.checklistItemId ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      idempotencyKey: input.idempotencyKey ?? null,
      createdByUserId: session.sub,
    })
    .returning();

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "PENDENCY_CREATE",
    entity: "pendency",
    entityId: created.id,
    newValue: {
      type: created.type,
      title: created.title,
      priority: created.priority,
      status: created.status,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  if (input.notifyClient) {
    await notifyPendencyCreated({
      tenantId: session.tenantId,
      processId: process.id,
      clientId: process.clientId,
      pendencyId: created.id,
      title: created.title,
      description: created.description,
      createdByUserId: session.sub,
      correlationId: meta?.correlationId,
    });
  }

  return created;
}

async function notifyPendencyCreated(input: {
  tenantId: string;
  processId: string;
  clientId: string;
  pendencyId: string;
  title: string;
  description: string;
  createdByUserId: string;
  correlationId?: string;
}) {
  const [process] = await db
    .select({
      processNumber: financingProcesses.processNumber,
      clientName: clients.fullName,
      email: clients.email,
      whatsapp: clients.whatsapp,
      phone: clients.phone,
    })
    .from(financingProcesses)
    .innerJoin(clients, eq(clients.id, financingProcesses.clientId))
    .where(
      and(
        eq(financingProcesses.id, input.processId),
        eq(financingProcesses.tenantId, input.tenantId),
      ),
    )
    .limit(1);

  if (!process) return;

  // Fresh portal token so the WhatsApp/email message can carry a deep link.
  // Domain pendency already committed — this is an ops side-effect.
  const access = await issuePortalAccessForNotify({
    tenantId: input.tenantId,
    processId: input.processId,
    createdByUserId: input.createdByUserId,
    expiresInHours: 72,
    label: `pendency:${input.pendencyId}`,
    correlationId: input.correlationId,
  });

  const message = buildPendencyPortalMessage({
    clientName: process.clientName,
    processNumber: process.processNumber,
    title: input.title,
    description: input.description,
    rawPortalToken: access.token,
  });

  await notify({
    tenantId: input.tenantId,
    processId: input.processId,
    clientId: input.clientId,
    eventType: "PENDENCY_CREATED",
    recipients: {
      EMAIL: process.email,
      WHATSAPP: normalizeWhatsAppRecipient(process.whatsapp || process.phone),
    },
    subject: message.subject,
    body: message.body,
    payload: {
      pendencyId: input.pendencyId,
      portalTokenId: access.id,
      portalPath: message.portalPath,
      // Never put raw token in persisted payload audit beyond path marker
      hasPortalDeepLink: true,
      correlationId: input.correlationId ?? null,
    },
  });
}

export async function updatePendency(
  session: SessionPayload,
  id: string,
  input: z.infer<typeof updatePendencySchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const [current] = await db
    .select()
    .from(pendencies)
    .where(and(eq(pendencies.id, id), eq(pendencies.tenantId, session.tenantId)))
    .limit(1);

  if (!current) {
    throw new AppError(404, "Pendência não encontrada", "PENDENCY_NOT_FOUND");
  }

  await loadProcessForSession(session, current.processId);

  const from = current.status as PendencyStatus;
  const to = input.status as PendencyStatus;

  const canWrite = hasPermission(session.role, "pendencies:write");
  const canRespond = hasPermission(session.role, "pendencies:respond");

  if (!canWrite) {
    if (!canRespond) {
      throw new AppError(403, "Acesso negado", "FORBIDDEN");
    }
    // Correspondent / limited: only OPEN|REJECTED → SUBMITTED
    if (
      to !== "SUBMITTED" ||
      (from !== "OPEN" && from !== "REJECTED" && from !== "SUBMITTED")
    ) {
      throw new AppError(
        403,
        "Correspondente só pode marcar pendência como enviada",
        "PENDENCY_RESPOND_ONLY",
      );
    }
  }

  try {
    assertPendencyTransition(from, to);
  } catch (error) {
    throw new AppError(
      400,
      error instanceof Error ? error.message : "Transição inválida",
      "INVALID_PENDENCY_TRANSITION",
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(pendencies)
    .set({
      status: to,
      ...(input.description && canWrite ? { description: input.description } : {}),
      ...(input.reviewNote !== undefined && canWrite
        ? { reviewNote: input.reviewNote }
        : {}),
      submittedAt:
        to === "SUBMITTED" ? (current.submittedAt ?? now) : current.submittedAt,
      resolvedAt:
        to === "RESOLVED" || to === "CANCELLED" ? now : null,
      reviewedByUserId:
        to === "UNDER_REVIEW" || to === "RESOLVED" || to === "REJECTED"
          ? session.sub
          : current.reviewedByUserId,
      updatedAt: now,
    })
    .where(and(eq(pendencies.id, id), eq(pendencies.tenantId, session.tenantId)))
    .returning();

  if (!updated) {
    throw new AppError(404, "Pendência não encontrada", "PENDENCY_NOT_FOUND");
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "PENDENCY_STATUS_CHANGE",
    entity: "pendency",
    entityId: id,
    oldValue: { status: from },
    newValue: {
      status: to,
      label: PENDENCY_STATUS_LABELS[to],
      reviewNote: input.reviewNote ?? null,
      responseNote: input.responseNote ?? null,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  if (to === "RESOLVED") {
    await notify({
      tenantId: session.tenantId,
      processId: current.processId,
      eventType: "PENDENCY_RESOLVED",
      body: `Pendência "${current.title}" resolvida.`,
      payload: { pendencyId: id },
    }).catch(() => undefined);
  }

  return updated;
}

/** Portal / upload path: OPEN|REJECTED → SUBMITTED */
export async function markPendencySubmitted(input: {
  tenantId: string;
  processId: string;
  pendencyId?: string;
  checklistItemId?: string | null;
  documentId?: string | null;
  portalTokenId?: string | null;
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string };
}) {
  if (!input.pendencyId && !input.checklistItemId) {
    return [];
  }

  const where = input.pendencyId
    ? and(
        eq(pendencies.id, input.pendencyId),
        eq(pendencies.tenantId, input.tenantId),
        eq(pendencies.processId, input.processId),
      )
    : and(
        eq(pendencies.tenantId, input.tenantId),
        eq(pendencies.processId, input.processId),
        eq(pendencies.checklistItemId, input.checklistItemId!),
        inArray(pendencies.status, ["OPEN", "REJECTED"]),
      );

  const rows = await db.select().from(pendencies).where(where);

  const updatedIds: string[] = [];
  for (const row of rows) {
    const from = row.status as PendencyStatus;
    if (from !== "OPEN" && from !== "REJECTED" && from !== "SUBMITTED") continue;
    try {
      assertPendencyTransition(from, "SUBMITTED");
    } catch {
      continue;
    }
    const now = new Date();
    await db
      .update(pendencies)
      .set({
        status: "SUBMITTED",
        submittedAt: row.submittedAt ?? now,
        documentId: input.documentId ?? row.documentId,
        updatedAt: now,
      })
      .where(eq(pendencies.id, row.id));
    updatedIds.push(row.id);

    await writeAuditLog({
      tenantId: input.tenantId,
      userId: null,
      action: "PENDENCY_SUBMITTED",
      entity: "pendency",
      entityId: row.id,
      newValue: {
        status: "SUBMITTED",
        portalTokenId: input.portalTokenId ?? null,
        documentId: input.documentId ?? null,
      },
      ip: input.meta?.ip,
      userAgent: input.meta?.userAgent,
      correlationId: input.meta?.correlationId,
    });
  }

  return updatedIds;
}
