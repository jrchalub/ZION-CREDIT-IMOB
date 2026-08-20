import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  creditAnalystReviews,
  decisionFactors,
  decisionSupportSnapshots,
  documentConsistencyChecks,
  financialAnalysisSnapshots,
  financingProcesses,
  pendencies,
  processChecklistItems,
} from "@/db/schema";
import { writeAuditLog } from "@/domain/audit/service";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";
import {
  CREDIT_SUPPORT_DISCLAIMER,
  CREDIT_SUPPORT_RULES_VERSION,
  CREDIT_SUPPORT_VERSION,
} from "../constants";
import {
  buildExplainableFactors,
  buildFactorMatrix,
  deriveIndicative,
} from "../factors/buildExplainableFactors";
import {
  buildDecisionSupportPayload,
  hashDecisionSupportPayload,
} from "../snapshot/DecisionSupportSnapshot";

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Builds an immutable Credit Decision Support snapshot.
 * Never overwrites previous snapshots. Never auto-approves.
 */
export async function runDecisionSupport(input: {
  processId: string;
  tenantId: string;
  userId?: string;
  correlationId?: string;
}) {
  const [process] = await db
    .select({
      id: financingProcesses.id,
      processNumber: financingProcesses.processNumber,
      clientId: financingProcesses.clientId,
    })
    .from(financingProcesses)
    .where(
      and(
        eq(financingProcesses.id, input.processId),
        eq(financingProcesses.tenantId, input.tenantId),
      ),
    )
    .limit(1);

  if (!process) throw new AppError(404, "Processo não encontrado", "PROCESS_NOT_FOUND");

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, process.clientId), eq(clients.tenantId, input.tenantId)))
    .limit(1);

  const [financialSnapshot] = await db
    .select()
    .from(financialAnalysisSnapshots)
    .where(
      and(
        eq(financialAnalysisSnapshots.processId, input.processId),
        eq(financialAnalysisSnapshots.tenantId, input.tenantId),
      ),
    )
    .orderBy(desc(financialAnalysisSnapshots.createdAt))
    .limit(1);

  const checklist = await db
    .select()
    .from(processChecklistItems)
    .where(
      and(
        eq(processChecklistItems.processId, input.processId),
        eq(processChecklistItems.tenantId, input.tenantId),
      ),
    );
  const required = checklist.filter((c) => c.requirement === "OBRIGATORIO");
  const validatedRequired = required.filter((c) => c.status === "VALIDADO");
  const documentationPct =
    required.length === 0
      ? 100
      : Math.round((validatedRequired.length / required.length) * 100);

  const openPendencies = await db
    .select()
    .from(pendencies)
    .where(
      and(
        eq(pendencies.processId, input.processId),
        eq(pendencies.tenantId, input.tenantId),
        inArray(pendencies.status, [
          "OPEN",
          "SUBMITTED",
          "UNDER_REVIEW",
          "REJECTED",
        ]),
      ),
    );

  const [consistency] = await db
    .select()
    .from(documentConsistencyChecks)
    .where(
      and(
        eq(documentConsistencyChecks.processId, input.processId),
        eq(documentConsistencyChecks.tenantId, input.tenantId),
      ),
    )
    .orderBy(desc(documentConsistencyChecks.createdAt))
    .limit(1);

  const financialPayload = (financialSnapshot?.payload ??
    null) as Record<string, unknown> | null;

  const factors = buildExplainableFactors({
    financialSnapshotId: financialSnapshot?.id ?? null,
    financialPayload,
    documentationPct,
    consistencyScore: consistency?.consistencyScore ?? null,
    consistencyFactors: consistency?.factors ?? [],
    consistencyIssues: consistency?.issues ?? [],
    openPendencies: openPendencies.map((p) => ({
      id: p.id,
      type: p.type,
      description: p.description,
      documentId: p.documentId,
    })),
    declaredIncome:
      num(client?.declaredIncome) ??
      num(financialPayload?.declaredIncome as string | number | null),
    analyzedIncome: num(financialPayload?.analyzedIncome as string | number | null),
  });

  const matrix = buildFactorMatrix(factors);
  const indicativeResult = deriveIndicative(matrix, factors);

  const payload = buildDecisionSupportPayload({
    processId: input.processId,
    processNumber: process.processNumber,
    financialSnapshotId: financialSnapshot?.id ?? null,
    indicativeResult,
    matrix,
    factors,
    summary: {
      documentationPct,
      consistencyScore: consistency?.consistencyScore ?? null,
      openPendencies: openPendencies.length,
      declaredIncome:
        num(client?.declaredIncome) ??
        num(financialPayload?.declaredIncome as string | number | null),
      analyzedIncome: num(
        financialPayload?.analyzedIncome as string | number | null,
      ),
      commitmentPct: num(
        financialPayload?.commitmentPct as string | number | null,
      ),
    },
  });

  const contentHash = hashDecisionSupportPayload(payload);

  const [snapshot] = await db
    .insert(decisionSupportSnapshots)
    .values({
      tenantId: input.tenantId,
      processId: input.processId,
      financialSnapshotId: financialSnapshot?.id ?? null,
      version: CREDIT_SUPPORT_VERSION,
      rulesVersion: CREDIT_SUPPORT_RULES_VERSION,
      indicativeResult,
      contentHash,
      payload,
      matrix,
      createdByUserId: input.userId ?? null,
    })
    .returning();

  if (factors.length > 0) {
    await db.insert(decisionFactors).values(
      factors.map((f) => ({
        tenantId: input.tenantId,
        processId: input.processId,
        decisionSupportSnapshotId: snapshot.id,
        kind: f.kind,
        code: f.code,
        description: f.description,
        severity: f.severity,
        category: f.category,
        originType: f.originType,
        originId: f.originId,
        originLabel: f.originLabel,
        evidence: f.evidence,
      })),
    );
  }

  // Open a PENDING review bound to this snapshot (append-only history)
  await db.insert(creditAnalystReviews).values({
    tenantId: input.tenantId,
    processId: input.processId,
    decisionSupportSnapshotId: snapshot.id,
    financialSnapshotId: financialSnapshot?.id ?? null,
    status: "PENDING",
  });

  await writeAuditLog({
    tenantId: input.tenantId,
    userId: input.userId,
    action: "DECISION_SUPPORT_SNAPSHOT_CREATED",
    entity: "process",
    entityId: input.processId,
    newValue: {
      snapshotId: snapshot.id,
      rulesVersion: CREDIT_SUPPORT_RULES_VERSION,
      indicativeResult,
      contentHash,
      financialSnapshotId: financialSnapshot?.id ?? null,
      factorCount: factors.length,
      disclaimer: CREDIT_SUPPORT_DISCLAIMER,
    },
    correlationId: input.correlationId,
  });

  return {
    snapshotId: snapshot.id,
    rulesVersion: CREDIT_SUPPORT_RULES_VERSION,
    indicativeResult,
    contentHash,
    factorCount: factors.length,
    matrix,
    disclaimer: CREDIT_SUPPORT_DISCLAIMER,
  };
}

export async function getLatestDecisionSupport(
  tenantId: string,
  processId: string,
) {
  const [snapshot] = await db
    .select()
    .from(decisionSupportSnapshots)
    .where(
      and(
        eq(decisionSupportSnapshots.processId, processId),
        eq(decisionSupportSnapshots.tenantId, tenantId),
      ),
    )
    .orderBy(desc(decisionSupportSnapshots.createdAt))
    .limit(1);

  if (!snapshot) return null;

  const factors = await db
    .select()
    .from(decisionFactors)
    .where(eq(decisionFactors.decisionSupportSnapshotId, snapshot.id));

  const [review] = await db
    .select()
    .from(creditAnalystReviews)
    .where(eq(creditAnalystReviews.decisionSupportSnapshotId, snapshot.id))
    .orderBy(desc(creditAnalystReviews.createdAt))
    .limit(1);

  return { snapshot, factors, review: review ?? null };
}
