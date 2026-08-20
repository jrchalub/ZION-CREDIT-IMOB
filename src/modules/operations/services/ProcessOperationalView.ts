import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { pendencies, processSla } from "@/db/schema";
import { loadProcessForSession } from "@/domain/access/scope";
import { listChecklist } from "@/domain/documents/checklist";
import {
  PROCESS_STATUS_LABELS,
  type ProcessStatus,
} from "@/domain/process/status-machine";
import type { SessionPayload } from "@/lib/auth/session";
import { OPEN_PENDENCY_STATUSES } from "@/modules/operations/pendencies/pendency-machine";
import {
  OPERATIONAL_STAGE_LABELS,
  toOperationalStage,
} from "@/modules/operations/workflow/operational-stages";

function hoursFromMs(ms: number | null | undefined) {
  if (ms == null) return null;
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
}

/**
 * Operational view for correspondent portal — no financial internals,
 * factors, snapshots, or analyst justification.
 */
export async function getProcessOperationalView(
  session: SessionPayload,
  processId: string,
) {
  const process = await loadProcessForSession(session, processId);
  const checklist = await listChecklist(session, processId);

  const openPendencies = await db
    .select()
    .from(pendencies)
    .where(
      and(
        eq(pendencies.processId, processId),
        eq(pendencies.tenantId, session.tenantId),
        inArray(pendencies.status, [...OPEN_PENDENCY_STATUSES]),
      ),
    );

  const [sla] = await db
    .select()
    .from(processSla)
    .where(
      and(
        eq(processSla.processId, processId),
        eq(processSla.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  const status = process.status as ProcessStatus;
  const stage = toOperationalStage(status);

  const analysisStatus = (() => {
    if (sla?.decidedAt) return "Decisão institucional registrada";
    if (sla?.sentToInstitutionAt) return "Enviado à instituição";
    if (sla?.reviewStartedAt || status === "PENDENCIA_ANALISTA") {
      return "Em parecer do analista";
    }
    if (sla?.dossierReadyAt || status === "APTO" || status === "PRE_ANALISADO") {
      return "Dossiê pronto para analista";
    }
    if (sla?.analysisStartedAt || status === "EM_ANALISE" || status === "EM_TRIAGEM") {
      return "Análise em andamento";
    }
    if (checklist.progress.pending > 0) return "Aguardando documentação";
    return "Em preparação";
  })();

  return {
    processId: process.id,
    processNumber: process.processNumber,
    status,
    statusLabel: PROCESS_STATUS_LABELS[status],
    operationalStage: stage,
    operationalStageLabel: OPERATIONAL_STAGE_LABELS[stage],
    analysisStatus,
    documentation: {
      percentComplete: checklist.progress.percent,
      pending: checklist.progress.pending,
      validated: checklist.progress.validated,
      completed: checklist.progress.completed,
      totalApplicable: checklist.progress.totalApplicable,
    },
    pendencies: openPendencies.map((p) => ({
      id: p.id,
      type: p.type,
      title: p.title,
      description: p.description,
      priority: p.priority,
      status: p.status,
      dueAt: p.dueAt,
      checklistItemId: p.checklistItemId,
    })),
    sla: sla
      ? {
          documentationHours: hoursFromMs(sla.documentationMs),
          analysisHours: hoursFromMs(sla.analysisMs),
          reviewHours: hoursFromMs(sla.reviewMs),
          totalHours: hoursFromMs(sla.totalMs),
          documentationStartedAt: sla.documentationStartedAt,
          analysisStartedAt: sla.analysisStartedAt,
          dossierReadyAt: sla.dossierReadyAt,
          reviewStartedAt: sla.reviewStartedAt,
          sentToInstitutionAt: sla.sentToInstitutionAt,
          decidedAt: sla.decidedAt,
        }
      : null,
    disclaimer:
      "Visão operacional do correspondente. Não inclui renda calculada, fatores internos, snapshots nem parecer do analista.",
  };
}
