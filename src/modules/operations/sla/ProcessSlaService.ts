import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { processSla } from "@/db/schema";
import type { ProcessStatus } from "@/domain/process/status-machine";

function msBetween(start: Date | null | undefined, end: Date | null | undefined) {
  if (!start || !end) return null;
  return Math.max(0, end.getTime() - start.getTime());
}

async function getOrCreateSla(tenantId: string, processId: string) {
  const [existing] = await db
    .select()
    .from(processSla)
    .where(
      and(eq(processSla.processId, processId), eq(processSla.tenantId, tenantId)),
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(processSla)
    .values({ tenantId, processId })
    .returning();
  return created;
}

/**
 * Updates SLA milestones based on process status transitions.
 */
export async function recordSlaTransition(input: {
  tenantId: string;
  processId: string;
  fromStatus: ProcessStatus;
  toStatus: ProcessStatus;
  openedAt?: Date | null;
}) {
  const now = new Date();
  const sla = await getOrCreateSla(input.tenantId, input.processId);
  const patch: Partial<typeof processSla.$inferInsert> = {
    updatedAt: now,
  };

  if (
    input.toStatus === "DOCUMENTACAO_PENDENTE" ||
    input.toStatus === "DOCUMENTACAO_RECEBIDA"
  ) {
    patch.documentationStartedAt = sla.documentationStartedAt ?? now;
  }

  if (
    input.toStatus === "EM_TRIAGEM" ||
    input.toStatus === "EM_ANALISE"
  ) {
    patch.documentationCompletedAt = sla.documentationCompletedAt ?? now;
    patch.analysisStartedAt = sla.analysisStartedAt ?? now;
  }

  if (input.toStatus === "PRE_ANALISADO" || input.toStatus === "APTO") {
    patch.analysisCompletedAt = sla.analysisCompletedAt ?? now;
    patch.dossierReadyAt = sla.dossierReadyAt ?? now;
  }

  if (input.toStatus === "PENDENCIA_ANALISTA") {
    patch.reviewStartedAt = sla.reviewStartedAt ?? now;
  }

  if (input.toStatus === "ENVIADO_AO_BANCO" || input.toStatus === "AGUARDANDO_BANCO") {
    patch.reviewCompletedAt = sla.reviewCompletedAt ?? now;
    patch.sentToInstitutionAt = sla.sentToInstitutionAt ?? now;
  }

  if (
    input.toStatus === "APROVADO" ||
    input.toStatus === "REPROVADO" ||
    input.toStatus === "CONTRATADO"
  ) {
    patch.decidedAt = now;
    patch.reviewCompletedAt = sla.reviewCompletedAt ?? now;
  }

  const documentationStartedAt =
    patch.documentationStartedAt ?? sla.documentationStartedAt;
  const documentationCompletedAt =
    patch.documentationCompletedAt ?? sla.documentationCompletedAt;
  const analysisStartedAt = patch.analysisStartedAt ?? sla.analysisStartedAt;
  const analysisCompletedAt =
    patch.analysisCompletedAt ?? sla.analysisCompletedAt;
  const reviewStartedAt = patch.reviewStartedAt ?? sla.reviewStartedAt;
  const reviewCompletedAt = patch.reviewCompletedAt ?? sla.reviewCompletedAt;
  const decidedAt = patch.decidedAt ?? sla.decidedAt;

  patch.documentationMs = msBetween(
    documentationStartedAt,
    documentationCompletedAt,
  );
  patch.analysisMs = msBetween(analysisStartedAt, analysisCompletedAt);
  patch.reviewMs = msBetween(reviewStartedAt, reviewCompletedAt);
  patch.totalMs = msBetween(input.openedAt ?? documentationStartedAt, decidedAt ?? now);

  const [updated] = await db
    .update(processSla)
    .set(patch)
    .where(eq(processSla.id, sla.id))
    .returning();

  return updated;
}
