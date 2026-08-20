import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, financingProcesses, integrationCalls } from "@/db/schema";
import { loadProcessForSession } from "@/domain/access/scope";
import { writeAuditLog } from "@/domain/audit/service";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";
import { getIntegrationProvider } from "./providers";
import type { IntegrationKind } from "./IntegrationProvider";

export const runIntegrationSchema = z.object({
  kind: z.enum(["BUREAU", "BANK_READ"]),
});

function cpfLast4(cpf: string | null | undefined): string | undefined {
  if (!cpf) return undefined;
  const digits = cpf.replace(/\D/g, "");
  if (digits.length < 4) return undefined;
  return digits.slice(-4);
}

/**
 * Runs a read-only external integration for a process.
 * Does not submit financing proposals (FASE 7).
 * Does not mutate credit snapshots / factors.
 */
export async function runProcessIntegration(
  session: SessionPayload,
  processId: string,
  kind: IntegrationKind,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const process = await loadProcessForSession(session, processId);

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

  const provider = getIntegrationProvider(kind);

  const [queued] = await db
    .insert(integrationCalls)
    .values({
      tenantId: session.tenantId,
      processId,
      clientId: process.clientId,
      kind,
      provider: provider.name,
      status: "QUEUED",
      requestSummary: {
        kind,
        processNumber: process.processNumber,
        cpfLast4: cpfLast4(client?.cpf),
        // never store full CPF
      },
      createdByUserId: session.sub,
    })
    .returning();

  const result = await provider.query({
    kind,
    tenantId: session.tenantId,
    processId,
    subjectHint: {
      clientId: client?.id,
      fullName: client?.fullName,
      cpfLast4: cpfLast4(client?.cpf),
    },
    metadata: { correlationId: meta?.correlationId },
  });

  const status = !result.ok
    ? "FAILED"
    : result.skipped
      ? "SKIPPED"
      : "SUCCEEDED";

  const [updated] = await db
    .update(integrationCalls)
    .set({
      status,
      responseSummary: result.summary,
      providerRef: result.providerRef ?? null,
      errorMessage: result.errorMessage ?? null,
    })
    .where(eq(integrationCalls.id, queued.id))
    .returning();

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "INTEGRATION_QUERY",
    entity: "integration_call",
    entityId: queued.id,
    newValue: {
      kind,
      provider: provider.name,
      status,
      providerRef: result.providerRef ?? null,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return updated;
}

export async function listProcessIntegrations(
  session: SessionPayload,
  processId: string,
) {
  await loadProcessForSession(session, processId);

  return db
    .select()
    .from(integrationCalls)
    .where(
      and(
        eq(integrationCalls.processId, processId),
        eq(integrationCalls.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(integrationCalls.createdAt));
}

/** Sanity helper for tests / health */
export async function assertProcessExists(tenantId: string, processId: string) {
  const [row] = await db
    .select({ id: financingProcesses.id })
    .from(financingProcesses)
    .where(
      and(
        eq(financingProcesses.id, processId),
        eq(financingProcesses.tenantId, tenantId),
      ),
    )
    .limit(1);
  if (!row) throw new AppError(404, "Processo não encontrado", "PROCESS_NOT_FOUND");
}
