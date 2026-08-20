import type { SQL } from "drizzle-orm";
import { and, eq, exists, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, financingProcesses, users } from "@/db/schema";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";
import {
  assertProcessOwnedBySession,
  isCorrespondentRole,
} from "./ownership";

export {
  assertProcessOwnedBySession,
  isCorrespondentRole,
} from "./ownership";

/**
 * SQL condition limiting financing_processes to the correspondent's portfolio.
 * Prefer correspondentId; fall back to createdByUserId when user is not linked.
 */
export function processOwnershipCondition(session: SessionPayload): SQL | undefined {
  if (!isCorrespondentRole(session)) return undefined;

  if (session.correspondentId) {
    return eq(financingProcesses.correspondentId, session.correspondentId);
  }

  return eq(financingProcesses.createdByUserId, session.sub);
}

export async function loadProcessForSession(
  session: SessionPayload,
  processId: string,
) {
  const [process] = await db
    .select()
    .from(financingProcesses)
    .where(
      and(
        eq(financingProcesses.id, processId),
        eq(financingProcesses.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  if (!process) {
    throw new AppError(404, "Processo não encontrado", "PROCESS_NOT_FOUND");
  }

  assertProcessOwnedBySession(session, process);
  return process;
}

/**
 * Clients visible to correspondent: created by them OR linked via owned process.
 */
export function clientOwnershipCondition(session: SessionPayload): SQL | undefined {
  if (!isCorrespondentRole(session)) return undefined;

  const ownedProcess = session.correspondentId
    ? and(
        eq(financingProcesses.clientId, clients.id),
        eq(financingProcesses.tenantId, session.tenantId),
        eq(financingProcesses.correspondentId, session.correspondentId),
      )
    : and(
        eq(financingProcesses.clientId, clients.id),
        eq(financingProcesses.tenantId, session.tenantId),
        eq(financingProcesses.createdByUserId, session.sub),
      );

  return or(
    eq(clients.createdByUserId, session.sub),
    exists(
      db
        .select({ one: sql`1` })
        .from(financingProcesses)
        .where(ownedProcess),
    ),
  );
}

export async function assertClientReadable(session: SessionPayload, clientId: string) {
  if (!isCorrespondentRole(session)) return;

  const ownership = clientOwnershipCondition(session);
  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.id, clientId),
        eq(clients.tenantId, session.tenantId),
        ownership,
      ),
    )
    .limit(1);

  if (!row) {
    throw new AppError(404, "Cliente não encontrado", "CLIENT_NOT_FOUND");
  }
}

export async function resolveUserCorrespondentId(
  userId: string,
  tenantId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ correspondentId: users.correspondentId })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .limit(1);
  return row?.correspondentId ?? null;
}
