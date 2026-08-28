import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, notifications, processAttendance } from "@/db/schema";
import { loadProcessForSession } from "@/domain/access/scope";
import { writeAuditLog } from "@/domain/audit/service";
import type { SessionPayload } from "@/lib/auth/session";
import { assertSameTenant } from "./attendance-rules";

export { assertSameTenant } from "./attendance-rules";

export const updateAttendanceSchema = z.object({
  externalConversationId: z.string().max(200).optional().nullable(),
  lastInteractionAt: z.string().datetime().optional().nullable(),
  nextVisitAt: z.string().datetime().optional().nullable(),
  nextVisitLocation: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function getProcessAttendance(
  session: SessionPayload,
  processId: string,
) {
  const process = await loadProcessForSession(session, processId);
  assertSameTenant(session.tenantId, process.tenantId);

  const [client] = await db
    .select({
      fullName: clients.fullName,
      whatsapp: clients.whatsapp,
      phone: clients.phone,
      email: clients.email,
    })
    .from(clients)
    .where(and(eq(clients.id, process.clientId), eq(clients.tenantId, session.tenantId)))
    .limit(1);

  const [attendance] = await db
    .select()
    .from(processAttendance)
    .where(
      and(
        eq(processAttendance.processId, processId),
        eq(processAttendance.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  const [lastWhatsapp] = await db
    .select({ createdAt: notifications.createdAt, sentAt: notifications.sentAt })
    .from(notifications)
    .where(
      and(
        eq(notifications.processId, processId),
        eq(notifications.tenantId, session.tenantId),
        eq(notifications.channel, "WHATSAPP"),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(1);

  return {
    processId,
    processNumber: process.processNumber,
    clientName: client?.fullName ?? null,
    whatsapp: client?.whatsapp ?? client?.phone ?? null,
    email: client?.email ?? null,
    linked: Boolean(attendance?.externalConversationId),
    externalConversationId: attendance?.externalConversationId ?? null,
    lastInteractionAt:
      attendance?.lastInteractionAt ?? lastWhatsapp?.sentAt ?? lastWhatsapp?.createdAt ?? null,
    nextVisitAt: attendance?.nextVisitAt ?? null,
    nextVisitLocation: attendance?.nextVisitLocation ?? null,
    notes: attendance?.notes ?? null,
  };
}

export async function updateProcessAttendance(
  session: SessionPayload,
  processId: string,
  input: z.infer<typeof updateAttendanceSchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const process = await loadProcessForSession(session, processId);
  assertSameTenant(session.tenantId, process.tenantId);

  const [existing] = await db
    .select()
    .from(processAttendance)
    .where(
      and(
        eq(processAttendance.processId, processId),
        eq(processAttendance.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  const values = {
    externalConversationId: input.externalConversationId ?? existing?.externalConversationId ?? null,
    lastInteractionAt: input.lastInteractionAt
      ? new Date(input.lastInteractionAt)
      : existing?.lastInteractionAt ?? null,
    nextVisitAt: input.nextVisitAt ? new Date(input.nextVisitAt) : existing?.nextVisitAt ?? null,
    nextVisitLocation: input.nextVisitLocation ?? existing?.nextVisitLocation ?? null,
    notes: input.notes ?? existing?.notes ?? null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(processAttendance)
      .set(values)
      .where(eq(processAttendance.id, existing.id));
  } else {
    await db.insert(processAttendance).values({
      tenantId: session.tenantId,
      processId,
      ...values,
    });
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "ATTENDANCE_UPDATE",
    entity: "process_attendance",
    entityId: processId,
    newValue: {
      externalConversationId: values.externalConversationId,
      nextVisitAt: values.nextVisitAt,
      nextVisitLocation: values.nextVisitLocation,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return getProcessAttendance(session, processId);
}
