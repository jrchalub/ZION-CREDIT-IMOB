import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  clients,
  financingProcesses,
  processNumberSequences,
  processStatusHistory,
} from "@/db/schema";
import {
  assertClientReadable,
  assertProcessOwnedBySession,
  isCorrespondentRole,
  processOwnershipCondition,
} from "@/domain/access/scope";
import { writeAuditLog } from "@/domain/audit/service";
import { generateChecklistForProcess } from "@/domain/documents/checklist";
import {
  PROCESS_STATUSES,
  assertTransition,
  getAllowedTransitions,
  type ProcessStatus,
} from "@/domain/process/status-machine";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";
import { toNumericMoneyString } from "@/lib/utils";

const optionalMoney = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value, ctx) => {
    try {
      return toNumericMoneyString(value ?? null);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Informe um valor numérico válido (ex.: 320000 ou 320.000,00)",
      });
      return z.NEVER;
    }
  });

export const createProcessSchema = z.object({
  clientId: z.uuid(),
  incomeProfile: z.enum([
    "AUTONOMO",
    "CLT",
    "MEI",
    "EMPRESARIO",
    "SERVIDOR_PUBLICO",
    "APOSENTADO",
    "PENSIONISTA",
    "COMPOSICAO_RENDA",
    "SOCIO_EMPRESA",
    "PRODUTOR_RURAL",
  ]),
  correspondentId: z.uuid().optional().nullable(),
  analystId: z.uuid().optional().nullable(),
  developmentId: z.uuid().optional().nullable(),
  unitId: z.uuid().optional().nullable(),
  intendedBank: z.string().max(80).optional().nullable(),
  institutionalChannel: z.enum(["NENHUM", "CAIXA", "OUTRO"]).optional(),
  institutionalSendOptIn: z.boolean().optional(),
  propertyValue: optionalMoney,
  downPayment: optionalMoney,
  financedAmount: optionalMoney,
  fgtsAmount: optionalMoney,
  amortizationSystem: z.enum(["SAC", "PRICE"]).optional().nullable(),
  financingType: z.string().max(80).optional().nullable(),
  hasCreditCard: z.boolean().optional().default(true),
});

export const transitionProcessSchema = z.object({
  toStatus: z.enum(PROCESS_STATUSES),
  reason: z.string().max(500).optional().nullable(),
});

export const updateProcessSchema = z.object({
  incomeProfile: z
    .enum([
      "AUTONOMO",
      "CLT",
      "MEI",
      "EMPRESARIO",
      "SERVIDOR_PUBLICO",
      "APOSENTADO",
      "PENSIONISTA",
      "COMPOSICAO_RENDA",
      "SOCIO_EMPRESA",
      "PRODUTOR_RURAL",
    ])
    .optional(),
  intendedBank: z.string().max(80).optional().nullable(),
  institutionalChannel: z.enum(["NENHUM", "CAIXA", "OUTRO"]).optional(),
  institutionalSendOptIn: z.boolean().optional(),
  propertyValue: optionalMoney,
  downPayment: optionalMoney,
  financedAmount: optionalMoney,
  fgtsAmount: optionalMoney,
  amortizationSystem: z.enum(["SAC", "PRICE"]).optional().nullable(),
  financingType: z.string().max(80).optional().nullable(),
  hasCreditCard: z.boolean().optional(),
});

const HARD_DELETE_SAFE_STATUSES: ProcessStatus[] = ["NOVO", "CANCELADO"];

function canHardDeleteProcess(
  session: SessionPayload,
  status: ProcessStatus,
): boolean {
  if (session.role === "ADMIN" || session.role === "GESTOR") return true;
  return HARD_DELETE_SAFE_STATUSES.includes(status);
}

async function nextProcessNumber(tenantId: string, year: number): Promise<string> {
  return db.transaction(async (tx) => {
    const [seq] = await tx
      .select()
      .from(processNumberSequences)
      .where(
        and(
          eq(processNumberSequences.tenantId, tenantId),
          eq(processNumberSequences.year, year),
        ),
      )
      .for("update");

    let next = 1;
    if (!seq) {
      await tx.insert(processNumberSequences).values({
        tenantId,
        year,
        lastNumber: 1,
      });
    } else {
      next = seq.lastNumber + 1;
      await tx
        .update(processNumberSequences)
        .set({ lastNumber: next })
        .where(eq(processNumberSequences.id, seq.id));
    }

    return `PF-${year}-${String(next).padStart(6, "0")}`;
  });
}

export async function listProcesses(
  session: SessionPayload,
  opts: {
    page: number;
    pageSize: number;
    offset: number;
    status?: ProcessStatus;
  },
) {
  const ownership = processOwnershipCondition(session);
  const where = opts.status
    ? and(
        eq(financingProcesses.tenantId, session.tenantId),
        eq(financingProcesses.status, opts.status),
        ownership,
      )
    : and(eq(financingProcesses.tenantId, session.tenantId), ownership);

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        process: financingProcesses,
        clientName: clients.fullName,
        clientCpf: clients.cpf,
      })
      .from(financingProcesses)
      .innerJoin(clients, eq(clients.id, financingProcesses.clientId))
      .where(where)
      .orderBy(desc(financingProcesses.openedAt))
      .limit(opts.pageSize)
      .offset(opts.offset),
    db.select({ value: count() }).from(financingProcesses).where(where),
  ]);

  return {
    items: rows.map((row) => ({
      ...row.process,
      clientName: row.clientName,
      clientCpf: row.clientCpf,
    })),
    page: opts.page,
    pageSize: opts.pageSize,
    total: Number(totalRow[0]?.value ?? 0),
  };
}

export async function getProcess(session: SessionPayload, id: string) {
  const [row] = await db
    .select({
      process: financingProcesses,
      clientName: clients.fullName,
      clientCpf: clients.cpf,
      clientProfession: clients.profession,
      declaredIncome: clients.declaredIncome,
    })
    .from(financingProcesses)
    .innerJoin(clients, eq(clients.id, financingProcesses.clientId))
    .where(
      and(
        eq(financingProcesses.id, id),
        eq(financingProcesses.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  if (!row) throw new AppError(404, "Processo não encontrado", "PROCESS_NOT_FOUND");
  assertProcessOwnedBySession(session, row.process);

  const history = await db
    .select()
    .from(processStatusHistory)
    .where(
      and(
        eq(processStatusHistory.processId, id),
        eq(processStatusHistory.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(processStatusHistory.createdAt));

  const hideInternal = isCorrespondentRole(session);

  return {
    ...row.process,
    clientName: row.clientName,
    clientCpf: row.clientCpf,
    clientProfession: row.clientProfession,
    declaredIncome: row.declaredIncome,
    analyzedIncome: hideInternal ? null : row.process.analyzedIncome,
    allowedTransitions: hideInternal
      ? []
      : getAllowedTransitions(row.process.status as ProcessStatus),
    statusHistory: history,
  };
}

export async function createProcess(
  session: SessionPayload,
  input: z.infer<typeof createProcessSchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, input.clientId), eq(clients.tenantId, session.tenantId)))
    .limit(1);

  if (!client) throw new AppError(404, "Cliente não encontrado", "CLIENT_NOT_FOUND");
  await assertClientReadable(session, input.clientId);

  const year = new Date().getFullYear();
  const processNumber = await nextProcessNumber(session.tenantId, year);

  const forcedCorrespondentId = isCorrespondentRole(session)
    ? session.correspondentId
    : (input.correspondentId ?? null);

  if (isCorrespondentRole(session) && !forcedCorrespondentId) {
    throw new AppError(
      400,
      "Usuário correspondente sem vínculo organizacional",
      "CORRESPONDENT_NOT_LINKED",
    );
  }

  const [created] = await db
    .insert(financingProcesses)
    .values({
      tenantId: session.tenantId,
      processNumber,
      clientId: input.clientId,
      incomeProfile: input.incomeProfile,
      correspondentId: forcedCorrespondentId,
      analystId: isCorrespondentRole(session) ? null : (input.analystId ?? null),
      developmentId: input.developmentId ?? null,
      unitId: input.unitId ?? null,
      intendedBank: input.intendedBank ?? null,
      institutionalChannel: input.institutionalChannel ?? "NENHUM",
      institutionalSendOptIn:
        (input.institutionalChannel ?? "NENHUM") === "NENHUM"
          ? false
          : Boolean(input.institutionalSendOptIn),
      propertyValue: input.propertyValue ?? null,
      downPayment: input.downPayment ?? null,
      financedAmount: input.financedAmount ?? null,
      fgtsAmount: input.fgtsAmount ?? null,
      amortizationSystem: input.amortizationSystem ?? null,
      financingType: input.financingType ?? null,
      status: "NOVO",
      createdByUserId: session.sub,
    })
    .returning();

  await db.insert(processStatusHistory).values({
    tenantId: session.tenantId,
    processId: created.id,
    fromStatus: null,
    toStatus: "NOVO",
    reason: "Abertura do processo",
    changedByUserId: session.sub,
  });

  await generateChecklistForProcess(
    session.tenantId,
    created.id,
    input.incomeProfile,
    { hasCreditCard: input.hasCreditCard ?? true },
  );

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "CREATE",
    entity: "financing_process",
    entityId: created.id,
    newValue: { processNumber, status: "NOVO", clientId: input.clientId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return getProcess(session, created.id);
}

export async function updateProcess(
  session: SessionPayload,
  id: string,
  input: z.infer<typeof updateProcessSchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const current = await getProcess(session, id);
  const profileChanged =
    input.incomeProfile !== undefined &&
    input.incomeProfile !== current.incomeProfile;

  const nextChannel =
    input.institutionalChannel ?? current.institutionalChannel;
  const nextOptIn =
    nextChannel === "NENHUM"
      ? false
      : (input.institutionalSendOptIn ?? current.institutionalSendOptIn);

  const [updated] = await db
    .update(financingProcesses)
    .set({
      ...(input.incomeProfile !== undefined
        ? { incomeProfile: input.incomeProfile }
        : {}),
      ...(input.intendedBank !== undefined
        ? { intendedBank: input.intendedBank }
        : {}),
      ...(input.institutionalChannel !== undefined ||
      input.institutionalSendOptIn !== undefined
        ? {
            institutionalChannel: nextChannel,
            institutionalSendOptIn: nextOptIn,
          }
        : {}),
      ...(input.propertyValue !== undefined
        ? { propertyValue: input.propertyValue }
        : {}),
      ...(input.downPayment !== undefined
        ? { downPayment: input.downPayment }
        : {}),
      ...(input.financedAmount !== undefined
        ? { financedAmount: input.financedAmount }
        : {}),
      ...(input.fgtsAmount !== undefined ? { fgtsAmount: input.fgtsAmount } : {}),
      ...(input.amortizationSystem !== undefined
        ? { amortizationSystem: input.amortizationSystem }
        : {}),
      ...(input.financingType !== undefined
        ? { financingType: input.financingType }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(financingProcesses.id, id),
        eq(financingProcesses.tenantId, session.tenantId),
      ),
    )
    .returning();

  if (!updated) {
    throw new AppError(404, "Processo não encontrado", "PROCESS_NOT_FOUND");
  }

  if (profileChanged || input.hasCreditCard !== undefined) {
    await generateChecklistForProcess(
      session.tenantId,
      id,
      updated.incomeProfile,
      { hasCreditCard: input.hasCreditCard ?? true },
    );
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "UPDATE",
    entity: "financing_process",
    entityId: id,
    oldValue: {
      incomeProfile: current.incomeProfile,
      intendedBank: current.intendedBank,
      institutionalChannel: current.institutionalChannel,
      institutionalSendOptIn: current.institutionalSendOptIn,
      propertyValue: current.propertyValue,
      downPayment: current.downPayment,
      financedAmount: current.financedAmount,
      fgtsAmount: current.fgtsAmount,
      amortizationSystem: current.amortizationSystem,
      financingType: current.financingType,
    },
    newValue: {
      incomeProfile: updated.incomeProfile,
      intendedBank: updated.intendedBank,
      institutionalChannel: updated.institutionalChannel,
      institutionalSendOptIn: updated.institutionalSendOptIn,
      propertyValue: updated.propertyValue,
      downPayment: updated.downPayment,
      financedAmount: updated.financedAmount,
      fgtsAmount: updated.fgtsAmount,
      amortizationSystem: updated.amortizationSystem,
      financingType: updated.financingType,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return getProcess(session, id);
}

export async function deleteProcess(
  session: SessionPayload,
  id: string,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const current = await getProcess(session, id);
  const status = current.status as ProcessStatus;

  if (!canHardDeleteProcess(session, status)) {
    throw new AppError(
      400,
      "Exclusão permanente só é permitida em NOVO ou CANCELADO. Cancele o processo antes ou peça a um gestor.",
      "PROCESS_DELETE_BLOCKED",
    );
  }

  await db
    .delete(financingProcesses)
    .where(
      and(
        eq(financingProcesses.id, id),
        eq(financingProcesses.tenantId, session.tenantId),
      ),
    );

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "DELETE",
    entity: "financing_process",
    entityId: id,
    oldValue: {
      processNumber: current.processNumber,
      status: current.status,
      clientId: current.clientId,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return { id, deleted: true as const };
}

export async function transitionProcess(
  session: SessionPayload,
  id: string,
  input: z.infer<typeof transitionProcessSchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const process = await getProcess(session, id);
  const from = process.status as ProcessStatus;
  const to = input.toStatus;

  try {
    assertTransition(from, to);
  } catch (error) {
    throw new AppError(
      400,
      error instanceof Error ? error.message : "Transição inválida",
      "INVALID_TRANSITION",
    );
  }

  const completedAt =
    to === "CONTRATADO" || to === "CANCELADO" || to === "REPROVADO"
      ? new Date()
      : null;

  const [updated] = await db
    .update(financingProcesses)
    .set({
      status: to,
      lastMovedAt: new Date(),
      completedAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(financingProcesses.id, id),
        eq(financingProcesses.tenantId, session.tenantId),
      ),
    )
    .returning();

  await db.insert(processStatusHistory).values({
    tenantId: session.tenantId,
    processId: id,
    fromStatus: from,
    toStatus: to,
    reason: input.reason ?? null,
    changedByUserId: session.sub,
  });

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "STATUS_CHANGE",
    entity: "financing_process",
    entityId: id,
    oldValue: { status: from },
    newValue: { status: to, reason: input.reason ?? null },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return getProcess(session, updated.id);
}

export async function getDashboardMetrics(session: SessionPayload) {
  const ownership = processOwnershipCondition(session);
  const where = and(eq(financingProcesses.tenantId, session.tenantId), ownership);

  const rows = await db
    .select({
      status: financingProcesses.status,
      value: count(),
    })
    .from(financingProcesses)
    .where(where)
    .groupBy(financingProcesses.status);

  const byStatus = Object.fromEntries(
    PROCESS_STATUSES.map((status) => [status, 0]),
  ) as Record<ProcessStatus, number>;

  for (const row of rows) {
    byStatus[row.status as ProcessStatus] = Number(row.value);
  }

  const [avgRow] = await db
    .select({
      avgHours: sql<number>`coalesce(avg(extract(epoch from (${financingProcesses.lastMovedAt} - ${financingProcesses.openedAt})) / 3600), 0)`,
    })
    .from(financingProcesses)
    .where(where);

  return {
    byStatus,
    totals: {
      novos: byStatus.NOVO,
      emAnalise: byStatus.EM_ANALISE + byStatus.EM_TRIAGEM,
      comPendencia:
        byStatus.DOCUMENTACAO_PENDENTE +
        byStatus.PENDENCIA_ANALISTA +
        byStatus.AGUARDANDO_CLIENTE,
      preAprovaveis: byStatus.APTO + byStatus.PRE_ANALISADO,
      reprovaveis: byStatus.NAO_APTO + byStatus.REPROVADO,
      enviadosAoBanco: byStatus.ENVIADO_AO_BANCO + byStatus.AGUARDANDO_BANCO,
      aprovados: byStatus.APROVADO,
      contratados: byStatus.CONTRATADO,
    },
    avgAnalysisHours: Number(avgRow?.avgHours ?? 0),
  };
}
