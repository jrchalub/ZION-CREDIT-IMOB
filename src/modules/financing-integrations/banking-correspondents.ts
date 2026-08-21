import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  bankingCorrespondents,
  commercialBankingAccess,
} from "@/db/schema";
import { isCorrespondentRole } from "@/domain/access/ownership";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";
import { requireBankingCorrespondentId } from "./banking-correspondent-rules";

export {
  assertIdsBelongToAllowedSet,
  assertNoCrossTenantBankingAccess,
  filterActiveBankingCorrespondents,
  requireBankingCorrespondentId,
  submissionsPreserveHistory,
  trackTargetsSpecificSubmission,
} from "./banking-correspondent-rules";

/**
 * Active banking correspondents the session may use for institutional submit.
 * - Analyst/admin/gestor: all ATIVO in tenant
 * - Commercial correspondent: only orgs linked via commercial_banking_access
 */
export async function listSelectableBankingCorrespondents(
  session: SessionPayload,
) {
  if (isCorrespondentRole(session)) {
    if (!session.correspondentId) {
      return [];
    }
    return db
      .select({
        id: bankingCorrespondents.id,
        name: bankingCorrespondents.name,
        document: bankingCorrespondents.document,
        status: bankingCorrespondents.status,
        phone: bankingCorrespondents.phone,
        email: bankingCorrespondents.email,
      })
      .from(commercialBankingAccess)
      .innerJoin(
        bankingCorrespondents,
        eq(
          bankingCorrespondents.id,
          commercialBankingAccess.bankingCorrespondentId,
        ),
      )
      .where(
        and(
          eq(commercialBankingAccess.tenantId, session.tenantId),
          eq(commercialBankingAccess.correspondentId, session.correspondentId),
          eq(commercialBankingAccess.active, true),
          eq(bankingCorrespondents.tenantId, session.tenantId),
          eq(bankingCorrespondents.status, "ATIVO"),
        ),
      )
      .orderBy(asc(bankingCorrespondents.name));
  }

  return db
    .select({
      id: bankingCorrespondents.id,
      name: bankingCorrespondents.name,
      document: bankingCorrespondents.document,
      status: bankingCorrespondents.status,
      phone: bankingCorrespondents.phone,
      email: bankingCorrespondents.email,
    })
    .from(bankingCorrespondents)
    .where(
      and(
        eq(bankingCorrespondents.tenantId, session.tenantId),
        eq(bankingCorrespondents.status, "ATIVO"),
      ),
    )
    .orderBy(asc(bankingCorrespondents.name));
}

export async function assertBankingCorrespondentSelectable(
  session: SessionPayload,
  bankingCorrespondentId: string,
) {
  requireBankingCorrespondentId(bankingCorrespondentId);

  const allowed = await listSelectableBankingCorrespondents(session);
  const match = allowed.find((row) => row.id === bankingCorrespondentId);
  if (!match) {
    throw new AppError(
      400,
      "Selecione um correspondente bancário ativo disponível para o seu acesso.",
      "BANKING_CORRESPONDENT_REQUIRED",
    );
  }

  const [row] = await db
    .select()
    .from(bankingCorrespondents)
    .where(
      and(
        eq(bankingCorrespondents.id, bankingCorrespondentId),
        eq(bankingCorrespondents.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  if (!row || row.status !== "ATIVO") {
    throw new AppError(
      400,
      "Correspondente bancário inativo ou inexistente neste tenant.",
      "BANKING_CORRESPONDENT_INACTIVE",
    );
  }

  return row;
}
