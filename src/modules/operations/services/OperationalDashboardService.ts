import { and, avg, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { financingProcesses, pendencies, processSla } from "@/db/schema";
import {
  PROCESS_STATUSES,
  type ProcessStatus,
} from "@/domain/process/status-machine";
import {
  OPERATIONAL_STAGES,
  toOperationalStage,
  type OperationalStage,
} from "../workflow/operational-stages";
import { classifyAgingDays } from "../workflow/aging";
import { OPEN_PENDENCY_STATUSES } from "../pendencies/pendency-machine";

function hoursToMs(h: number) {
  return h * 60 * 60 * 1000;
}

/**
 * Operational dashboard: queues, aging, SLA averages.
 */
export async function getOperationalDashboard(tenantId: string) {
  const processes = await db
    .select({
      id: financingProcesses.id,
      status: financingProcesses.status,
      openedAt: financingProcesses.openedAt,
      lastMovedAt: financingProcesses.lastMovedAt,
    })
    .from(financingProcesses)
    .where(eq(financingProcesses.tenantId, tenantId));

  const byStatus = Object.fromEntries(
    PROCESS_STATUSES.map((s) => [s, 0]),
  ) as Record<ProcessStatus, number>;

  const byStage = Object.fromEntries(
    OPERATIONAL_STAGES.map((s) => [s, 0]),
  ) as Record<OperationalStage, number>;

  const now = Date.now();
  const aging = {
    d0_2: 0,
    d3_5: 0,
    d6_10: 0,
    d10plus: 0,
  };

  for (const p of processes) {
    byStatus[p.status as ProcessStatus] += 1;
    byStage[toOperationalStage(p.status as ProcessStatus)] += 1;

    const ageDays =
      (now - new Date(p.lastMovedAt ?? p.openedAt).getTime()) /
      (1000 * 60 * 60 * 24);
    aging[classifyAgingDays(ageDays)] += 1;
  }

  const [openPendencies] = await db
    .select({ value: count() })
    .from(pendencies)
    .where(
      and(
        eq(pendencies.tenantId, tenantId),
        inArray(pendencies.status, [...OPEN_PENDENCY_STATUSES]),
      ),
    );

  const [slaAvg] = await db
    .select({
      avgDocumentationMs: avg(processSla.documentationMs),
      avgAnalysisMs: avg(processSla.analysisMs),
      avgReviewMs: avg(processSla.reviewMs),
      avgTotalMs: avg(processSla.totalMs),
    })
    .from(processSla)
    .where(eq(processSla.tenantId, tenantId));

  const toHours = (ms: string | null) =>
    ms ? Math.round((Number(ms) / hoursToMs(1)) * 10) / 10 : 0;

  return {
    totals: {
      novos: byStage.NOVO,
      aguardandoDocumentos: byStage.AGUARDANDO_DOCUMENTOS,
      documentacaoEmAnalise: byStage.DOCUMENTACAO_EM_ANALISE,
      pendencias: byStage.PENDENCIA,
      emAnalise: byStage.ANALISE_FINANCEIRA + byStage.EM_ANALISE,
      dossiesProntos: byStage.DOSSIE_PRONTO,
      aguardandoAnalista: byStage.PARECER + byStage.DOSSIE_PRONTO,
      enviadosInstituicao:
        byStage.ENVIADO_PARA_INSTITUICAO + byStage.EM_AVALIACAO,
      aprovados: byStage.APROVADO,
      contratacao: byStage.CONTRATACAO,
      openPendencies: Number(openPendencies?.value ?? 0),
      totalProcessos: processes.length,
    },
    byStatus,
    byStage,
    aging,
    sla: {
      avgDocumentationHours: toHours(
        slaAvg?.avgDocumentationMs != null
          ? String(slaAvg.avgDocumentationMs)
          : null,
      ),
      avgAnalysisHours: toHours(
        slaAvg?.avgAnalysisMs != null ? String(slaAvg.avgAnalysisMs) : null,
      ),
      avgReviewHours: toHours(
        slaAvg?.avgReviewMs != null ? String(slaAvg.avgReviewMs) : null,
      ),
      avgTotalHours: toHours(
        slaAvg?.avgTotalMs != null ? String(slaAvg.avgTotalMs) : null,
      ),
    },
  };
}
