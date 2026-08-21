import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  bankingCorrespondents,
  clients,
  creditAnalystReviews,
  decisionSupportSnapshots,
  financingProcesses,
  financingSubmissionEvents,
  financingSubmissions,
  processStatusHistory,
  users,
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
import {
  assertBankingCorrespondentSelectable,
  listSelectableBankingCorrespondents,
  requireBankingCorrespondentId,
} from "./banking-correspondents";
import { canSubmitFinancing } from "./status-gate";
import type { FinancingInstitution } from "./FinancingProvider";
import { getFinancingProvider } from "./providers";

export { canSubmitFinancing } from "./status-gate";
export { listSelectableBankingCorrespondents } from "./banking-correspondents";

export const submitFinancingSchema = z.object({
  institution: z.enum(["CAIXA"]).default("CAIXA"),
  bankingCorrespondentId: z.uuid(),
});

function cpfLast4(cpf: string | null | undefined): string | undefined {
  if (!cpf) return undefined;
  const digits = cpf.replace(/\D/g, "");
  if (digits.length < 4) return undefined;
  return digits.slice(-4);
}

async function appendSubmissionEvent(input: {
  tenantId: string;
  submissionId: string;
  fromStatus: string | null;
  toStatus: string;
  externalStatus?: string | null;
  note?: string | null;
  userId?: string | null;
}) {
  await db.insert(financingSubmissionEvents).values({
    tenantId: input.tenantId,
    submissionId: input.submissionId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    externalStatus: input.externalStatus ?? null,
    note: input.note ?? null,
    createdByUserId: input.userId ?? null,
  });
}

/**
 * Submit process metadata to an institutional FinancingProvider.
 * Requires explicit banking correspondent selection.
 */
export async function submitProcessFinancing(
  session: SessionPayload,
  processId: string,
  input: z.infer<typeof submitFinancingSchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const bankingCorrespondentId = requireBankingCorrespondentId(
    input.bankingCorrespondentId,
  );
  const bankingCorrespondent = await assertBankingCorrespondentSelectable(
    session,
    bankingCorrespondentId,
  );

  const process = await loadProcessForSession(session, processId);
  const fromStatus = process.status as ProcessStatus;

  if (!canSubmitFinancing(fromStatus)) {
    throw new AppError(
      400,
      `Envio institucional só é permitido em APTO, AGUARDANDO_BANCO ou ENVIADO_AO_BANCO (atual: ${fromStatus}).`,
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

  const [submitter] = await db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(and(eq(users.id, session.sub), eq(users.tenantId, session.tenantId)))
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
    bankingCorrespondentId: bankingCorrespondent.id,
    bankingCorrespondentName: bankingCorrespondent.name,
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
    submittedByUserId: session.sub,
    submittedByName: submitter?.fullName ?? null,
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
      bankingCorrespondentId: bankingCorrespondent.id,
      institution,
      provider: provider.name,
      status: "QUEUED",
      requestSummary: proposal,
      submittedByUserId: session.sub,
    })
    .returning();

  await appendSubmissionEvent({
    tenantId: session.tenantId,
    submissionId: queued.id,
    fromStatus: null,
    toStatus: "QUEUED",
    note: `Selecionado correspondente bancário ${bankingCorrespondent.name}`,
    userId: session.sub,
  });

  const result = await provider.submit({
    institution,
    tenantId: session.tenantId,
    processId,
    proposal,
    metadata: {
      correlationId: meta?.correlationId,
      bankingCorrespondentId: bankingCorrespondent.id,
    },
  });

  const now = new Date();
  const nextStatus = !result.ok ? ("FAILED" as const) : ("SUBMITTED" as const);

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

  await appendSubmissionEvent({
    tenantId: session.tenantId,
    submissionId: queued.id,
    fromStatus: "QUEUED",
    toStatus: nextStatus,
    externalStatus: result.externalStatus ?? null,
    note: result.ok
      ? `Enviado à ${institution} via ${bankingCorrespondent.name}`
      : (result.errorMessage ?? "Falha no envio"),
    userId: session.sub,
  });

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
      reason: `Envio institucional ${institution} · ${bankingCorrespondent.name}`,
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
        bankingCorrespondentId: bankingCorrespondent.id,
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
      bankingCorrespondentId: bankingCorrespondent.id,
      bankingCorrespondentName: bankingCorrespondent.name,
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
    metadata: {
      correlationId: meta?.correlationId,
      bankingCorrespondentId: submission.bankingCorrespondentId,
    },
  });

  const now = new Date();
  const nextStatus = result.ok ? ("TRACKING" as const) : ("FAILED" as const);
  const [updated] = await db
    .update(financingSubmissions)
    .set({
      status: nextStatus,
      externalStatus: result.externalStatus ?? submission.externalStatus,
      responseSummary: result.summary,
      errorMessage: result.errorMessage ?? null,
      lastTrackedAt: now,
      updatedAt: now,
    })
    .where(eq(financingSubmissions.id, submission.id))
    .returning();

  await appendSubmissionEvent({
    tenantId: session.tenantId,
    submissionId: submission.id,
    fromStatus: submission.status,
    toStatus: nextStatus,
    externalStatus: result.externalStatus ?? null,
    note: "Track institucional (submissão específica)",
    userId: session.sub,
  });

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "FINANCING_TRACK",
    entity: "financing_submission",
    entityId: submission.id,
    newValue: {
      providerRef: submission.providerRef,
      bankingCorrespondentId: submission.bankingCorrespondentId,
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

  const rows = await db
    .select({
      submission: financingSubmissions,
      bankingCorrespondentName: bankingCorrespondents.name,
      bankingCorrespondentDocument: bankingCorrespondents.document,
      submittedByName: users.fullName,
    })
    .from(financingSubmissions)
    .leftJoin(
      bankingCorrespondents,
      eq(bankingCorrespondents.id, financingSubmissions.bankingCorrespondentId),
    )
    .leftJoin(users, eq(users.id, financingSubmissions.submittedByUserId))
    .where(
      and(
        eq(financingSubmissions.processId, processId),
        eq(financingSubmissions.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(financingSubmissions.createdAt));

  const submissionIds = rows.map((row) => row.submission.id);
  const eventRows =
    submissionIds.length === 0
      ? []
      : await db
          .select()
          .from(financingSubmissionEvents)
          .where(
            and(
              eq(financingSubmissionEvents.tenantId, session.tenantId),
              inArray(financingSubmissionEvents.submissionId, submissionIds),
            ),
          )
          .orderBy(asc(financingSubmissionEvents.createdAt));

  const eventsBySubmission = new Map<string, typeof eventRows>();
  for (const event of eventRows) {
    const list = eventsBySubmission.get(event.submissionId) ?? [];
    list.push(event);
    eventsBySubmission.set(event.submissionId, list);
  }

  return rows.map((row, index) => ({
    ...row.submission,
    submissionLabel: `SUB-${String(rows.length - index).padStart(3, "0")}`,
    bankingCorrespondentName: row.bankingCorrespondentName,
    bankingCorrespondentDocument: row.bankingCorrespondentDocument,
    submittedByName: row.submittedByName,
    events: eventsBySubmission.get(row.submission.id) ?? [],
  }));
}
