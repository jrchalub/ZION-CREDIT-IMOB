import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { financingProcesses, pendencies } from "@/db/schema";
import { writeAuditLog } from "@/domain/audit/service";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";

export const createPendencySchema = z.object({
  processId: z.uuid(),
  type: z.string().min(2).max(80),
  description: z.string().min(3).max(2000),
  priority: z.enum(["BAIXA", "MEDIA", "ALTA", "CRITICA"]).default("MEDIA"),
  documentId: z.uuid().optional().nullable(),
  checklistItemId: z.uuid().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
});

export const updatePendencySchema = z.object({
  status: z.enum(["ABERTA", "EM_ANDAMENTO", "RESOLVIDA", "CANCELADA"]),
  description: z.string().min(3).max(2000).optional(),
});

export async function listPendencies(
  session: SessionPayload,
  processId: string,
) {
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

export async function createPendency(
  session: SessionPayload,
  input: z.infer<typeof createPendencySchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const [process] = await db
    .select({ id: financingProcesses.id })
    .from(financingProcesses)
    .where(
      and(
        eq(financingProcesses.id, input.processId),
        eq(financingProcesses.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  if (!process) throw new AppError(404, "Processo não encontrado", "PROCESS_NOT_FOUND");

  const [created] = await db
    .insert(pendencies)
    .values({
      tenantId: session.tenantId,
      processId: input.processId,
      type: input.type,
      description: input.description,
      priority: input.priority,
      documentId: input.documentId ?? null,
      checklistItemId: input.checklistItemId ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      createdByUserId: session.sub,
    })
    .returning();

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "CREATE",
    entity: "pendency",
    entityId: created.id,
    newValue: { type: created.type, priority: created.priority },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return created;
}

export async function updatePendency(
  session: SessionPayload,
  id: string,
  input: z.infer<typeof updatePendencySchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const [updated] = await db
    .update(pendencies)
    .set({
      status: input.status,
      ...(input.description ? { description: input.description } : {}),
      resolvedAt:
        input.status === "RESOLVIDA" || input.status === "CANCELADA"
          ? new Date()
          : null,
      updatedAt: new Date(),
    })
    .where(and(eq(pendencies.id, id), eq(pendencies.tenantId, session.tenantId)))
    .returning();

  if (!updated) {
    throw new AppError(404, "Pendência não encontrada", "PENDENCY_NOT_FOUND");
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "UPDATE",
    entity: "pendency",
    entityId: id,
    newValue: { status: updated.status },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return updated;
}
