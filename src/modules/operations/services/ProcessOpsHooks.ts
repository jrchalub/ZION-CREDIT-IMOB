import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, financingProcesses } from "@/db/schema";
import {
  PROCESS_STATUS_LABELS,
  type ProcessStatus,
} from "@/domain/process/status-machine";
import {
  buildStatusChangeMessage,
  notify,
} from "../notifications/NotificationService";
import { recordSlaTransition } from "../sla/ProcessSlaService";
import {
  eventForStatusTransition,
  OPERATIONAL_STAGE_LABELS,
  toOperationalStage,
} from "../workflow/operational-stages";

/**
 * Side-effects after a process status change (FASE 6).
 * Does not alter credit/decision logic from FASES 1–5.
 */
export async function onProcessStatusChanged(input: {
  tenantId: string;
  processId: string;
  fromStatus: ProcessStatus;
  toStatus: ProcessStatus;
  correlationId?: string;
}) {
  const [process] = await db
    .select({
      id: financingProcesses.id,
      processNumber: financingProcesses.processNumber,
      openedAt: financingProcesses.openedAt,
      clientId: financingProcesses.clientId,
      clientName: clients.fullName,
      clientEmail: clients.email,
      clientWhatsapp: clients.whatsapp,
      clientPhone: clients.phone,
    })
    .from(financingProcesses)
    .innerJoin(clients, eq(financingProcesses.clientId, clients.id))
    .where(
      and(
        eq(financingProcesses.id, input.processId),
        eq(financingProcesses.tenantId, input.tenantId),
      ),
    )
    .limit(1);

  if (!process) return { notified: false, sla: null };

  const sla = await recordSlaTransition({
    tenantId: input.tenantId,
    processId: input.processId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    openedAt: process.openedAt,
  });

  const stage = toOperationalStage(input.toStatus);
  const message = buildStatusChangeMessage({
    clientName: process.clientName,
    processNumber: process.processNumber,
    toStatusLabel: PROCESS_STATUS_LABELS[input.toStatus],
    operationalStageLabel: OPERATIONAL_STAGE_LABELS[stage],
  });

  const recipient =
    process.clientEmail || process.clientWhatsapp || process.clientPhone || null;

  const notified = await notify({
    tenantId: input.tenantId,
    processId: input.processId,
    clientId: process.clientId,
    eventType: eventForStatusTransition(input.toStatus),
    recipient,
    subject: message.subject,
    body: message.body,
    payload: {
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      operationalStage: stage,
      correlationId: input.correlationId ?? null,
    },
  });

  return { notified: notified.length > 0, sla, deliveries: notified };
}
