import { AppError } from "@/lib/api";

/** Pure helpers for unit tests (no DB). */
export function filterActiveBankingCorrespondents<
  T extends { id: string; status: string },
>(rows: T[], allowedIds?: string[] | null) {
  const active = rows.filter((row) => row.status === "ATIVO");
  if (!allowedIds) return active;
  const set = new Set(allowedIds);
  return active.filter((row) => set.has(row.id));
}

export function requireBankingCorrespondentId(
  bankingCorrespondentId: string | null | undefined,
): string {
  if (!bankingCorrespondentId?.trim()) {
    throw new AppError(
      400,
      "Selecione o correspondente bancário antes de enviar.",
      "BANKING_CORRESPONDENT_REQUIRED",
    );
  }
  return bankingCorrespondentId;
}

export function assertNoCrossTenantBankingAccess(input: {
  sessionTenantId: string;
  entityTenantId: string;
}) {
  if (input.sessionTenantId !== input.entityTenantId) {
    throw new AppError(403, "Acesso cross-tenant negado", "CROSS_TENANT");
  }
}

export function assertIdsBelongToAllowedSet(
  bankingCorrespondentId: string,
  allowedIds: string[],
) {
  if (!allowedIds.includes(bankingCorrespondentId)) {
    throw new AppError(
      403,
      "Correspondente bancário não disponível para esta organização",
      "BANKING_CORRESPONDENT_FORBIDDEN",
    );
  }
}

export function submissionsPreserveHistory(
  existing: Array<{ id: string }>,
  created: { id: string },
) {
  return [...existing, created];
}

export function trackTargetsSpecificSubmission(
  submissions: Array<{ id: string; status: string }>,
  submissionId: string,
  nextStatus: string,
) {
  return submissions.map((row) =>
    row.id === submissionId ? { ...row, status: nextStatus } : row,
  );
}
