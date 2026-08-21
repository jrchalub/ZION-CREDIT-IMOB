import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  clients,
  creditAnalystReviews,
  decisionSupportSnapshots,
  financingProcesses,
  financingSubmissions,
  processStatusHistory,
} from "@/db/schema";
import { loadProcessForSession } from "@/domain/access/scope";
import { writeAuditLog } from "@/domain/audit/service";
import { listChecklist } from "@/domain/documents/checklist";
import {
  assertTransition,
  type ProcessStatus,
} from "@/domain/process/status-machine";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";
import { canSubmitFinancing } from "./status-gate";
import type { FinancingInstitution } from "./FinancingProvider";
import { getFinancingProvider } from "./providers";

export { canSubmitFinancing } from "./status-gate";

export const submitFinancingSchema = z.object({
  institution: z.enum(["CAIXA"]).default("CAIXA"),
});

function cpfLast4(cpf: string | null | undefined): string | undefined {
  if (!cpf) return undefined;
  const digits = cpf.replace(/\D/g, "");
  if (digits.length < 4) return undefined;
  return digits.slice(-4);
}

/**
 * Submit process metadata to an institutional FinancingProvider.
 * Does not upload document binaries. Does not mutate credit snapshots.
 */
export async function submitProcessFinancing(
  session: SessionPayload,
  processId: string,
  input: z.infer<typeof submitFinancingSchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const process = await loadProcessForSession(session, processId);
  const fromStatus = process.status as ProcessStatus;

  if (!canSubmitFinancing(fromStatus)) {
    throw new AppError(
      400,
      `Envio institucional só é permitido em APTO ou AGUARDANDO_BANCO (atual: ${fromStatus}).`,
      "FINANCING_STATUS_GATE",
    );
  }

  const institution = input.institution as FinancingInstitution;

  const [client] = await db
    .select({
      id: clients.id,
      fullName: clients.fullName,
      cpf: clients.cpf,
    })
    .from(clients)
    .where(
      and(eq(clients.id, process.clientId), eq(clients.tenantId, session.tenantId)),
    )
    .limit(1);

  const checklist = await listChecklist(session, processId);

  const [decisionSnapshot] = await db
    .select({
      id: decisionSupportSnapshots.id,
      indicativeResult: decisionSupportSnapshots.indicativeResult,
      contentHash: decisionSupportSnapshots.contentHash,
    })
    .from(decisionSupportSnapshots)
    .where(
      and(
        eq(decisionSupportSnapshots.processId, processId),
        eq(decisionSupportSnapshots.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(decisionSupportSnapshots.createdAt))
    .limit(1);

  let analystDecision: string | null = null;
  if (decisionSnapshot) {
    const [review] = await db
      .select({ decision: creditAnalystReviews.decision })
      .from(creditAnalystReviews)
      .where(
        eq(creditAnalystReviews.decisionSupportSnapshotId, decisionSnapshot.id),
      )
      .orderBy(desc(creditAnalystReviews.createdAt))
      .limit(1);
    analystDecision = review?.decision ?? null;
  }

  const proposal = {
    processNumber: process.processNumber,
    institution,
    intendedBank: process.intendedBank,
    propertyValue: process.propertyValue,
    downPayment: process.downPayment,
    financedAmount: process.financedAmount,
    fgtsAmount: process.fgtsAmount,
    amortizationSystem: process.amortizationSystem,
    financingType: process.financingType,
    incomeProfile: process.incomeProfile,
    checklistProgressPercent: checklist.progress.percent,
    checklistPending: checklist.progress.pending,
    decisionSupportSnapshotId: decisionSnapshot?.id ?? null,
    decisionIndicative: decisionSnapshot?.indicativeResult ?? null,
    decisionContentHash: decisionSnapshot?.contentHash ?? null,
    analystDecision,
    subjectHint: {
      clientId: client?.id,
      fullName: client?.fullName,
      cpfLast4: cpfLast4(client?.cpf),
    },
  };

  const provider = getFinancingProvider(institution);

  const [queued] = await db
    .insert(financingSubmissions)
    .values({
      tenantId: session.tenantId,
      processId,
      institution,
      provider: provider.name,
      status: "QUEUED",
      requestSummary: proposal,
      submittedByUserId: session.sub,
    })
    .returning();

  const result = await provider.submit({
    institution,
    tenantId: session.tenantId,
    processId,
    proposal,
    metadata: { correlationId: meta?.correlationId },
  });

  const now = new Date();
  const nextStatus = !result.ok
    ? ("FAILED" as const)
    : result.skipped
      ? ("SUBMITTED" as const)
      : ("SUBMITTED" as const);

  const [updated] = await db
    .update(financingSubmissions)
    .set({
      status: nextStatus,
      providerRef: result.providerRef ?? null,
      externalStatus: result.externalStatus ?? null,
      responseSummary: result.summary,
      errorMessage: result.errorMessage ?? null,
      submittedAt: result.ok ? now : null,
      updatedAt: now,
    })
    .where(eq(financingSubmissions.id, queued.id))
    .returning();

  if (result.ok && fromStatus !== "ENVIADO_AO_BANCO") {
    try {
      assertTransition(fromStatus, "ENVIADO_AO_BANCO");
    } catch (error) {
      throw new AppError(
        400,
        error instanceof Error ? error.message : "Transição inválida",
        "INVALID_TRANSITION",
      );
    }

    await db
      .update(financingProcesses)
      .set({
        status: "ENVIADO_AO_BANCO",
        lastMovedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(financingProcesses.id, processId),
          eq(financingProcesses.tenantId, session.tenantId),
        ),
      );

    await db.insert(processStatusHistory).values({
      tenantId: session.tenantId,
      processId,
      fromStatus,
      toStatus: "ENVIADO_AO_BANCO",
      reason: `Envio institucional ${institution} (${provider.name})`,
      changedByUserId: session.sub,
    });

    await writeAuditLog({
      tenantId: session.tenantId,
      userId: session.sub,
      action: "STATUS_CHANGE",
      entity: "financing_process",
      entityId: processId,
      oldValue: { status: fromStatus },
      newValue: {
        status: "ENVIADO_AO_BANCO",
        reason: `Envio institucional ${institution}`,
      },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "FINANCING_SUBMIT",
    entity: "financing_submission",
    entityId: queued.id,
    newValue: {
      institution,
      provider: provider.name,
      status: nextStatus,
      providerRef: result.providerRef ?? null,
      processStatus: result.ok ? "ENVIADO_AO_BANCO" : fromStatus,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  if (!result.ok) {
    throw new AppError(
      502,
      result.errorMessage ?? "Falha no envio institucional",
      "FINANCING_SUBMIT_FAILED",
    );
  }

  return updated;
}

export async function trackProcessFinancing(
  session: SessionPayload,
  processId: string,
  submissionId: string,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  await loadProcessForSession(session, processId);

  const [submission] = await db
    .select()
    .from(financingSubmissions)
    .where(
      and(
        eq(financingSubmissions.id, submissionId),
        eq(financingSubmissions.processId, processId),
        eq(financingSubmissions.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  if (!submission) {
    throw new AppError(404, "Submissão não encontrada", "FINANCING_NOT_FOUND");
  }
  if (!submission.providerRef) {
    throw new AppError(
      400,
      "Submissão sem referência do provedor",
      "FINANCING_NO_REF",
    );
  }

  const provider = getFinancingProvider(submission.institution);
  const result = await provider.track({
    institution: submission.institution,
    tenantId: session.tenantId,
    processId,
    providerRef: submission.providerRef,
    metadata: { correlationId: meta?.correlationId },
  });

  const now = new Date();
  const [updated] = await db
    .update(financingSubmissions)
    .set({
      status: result.ok ? "TRACKING" : "FAILED",
      externalStatus: result.externalStatus ?? submission.externalStatus,
      responseSummary: result.summary,
      errorMessage: result.errorMessage ?? null,
      lastTrackedAt: now,
      updatedAt: now,
    })
    .where(eq(financingSubmissions.id, submission.id))
    .returning();

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "FINANCING_TRACK",
    entity: "financing_submission",
    entityId: submission.id,
    newValue: {
      providerRef: submission.providerRef,
      externalStatus: result.externalStatus ?? null,
      ok: result.ok,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return updated;
}

export async function listProcessFinancing(
  session: SessionPayload,
  processId: string,
) {
  await loadProcessForSession(session, processId);

  return db
    .select()
    .from(financingSubmissions)
    .where(
      and(
        eq(financingSubmissions.processId, processId),
        eq(financingSubmissions.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(financingSubmissions.createdAt));
}
