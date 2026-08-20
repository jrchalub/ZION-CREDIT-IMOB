import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { portalAccessTokens } from "@/db/schema";
import { loadProcessForSession } from "@/domain/access/scope";
import { writeAuditLog } from "@/domain/audit/service";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";
import {
  evaluatePortalTokenAccess,
  generateRawPortalToken,
  hashPortalToken,
  portalFailureStatus,
  type PortalTokenRecord,
} from "./token-crypto";

export const issuePortalAccessSchema = z.object({
  expiresInHours: z.number().int().min(1).max(24 * 90).default(72),
  label: z.string().max(120).optional().nullable(),
  revokePrevious: z.boolean().optional().default(true),
});

function toRecord(row: typeof portalAccessTokens.$inferSelect): PortalTokenRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    processId: row.processId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}

/**
 * Issues a portal access token. Raw token returned once; only hash is stored.
 */
export async function issuePortalAccess(
  session: SessionPayload,
  processId: string,
  input: z.infer<typeof issuePortalAccessSchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const process = await loadProcessForSession(session, processId);
  const rawToken = generateRawPortalToken();
  const tokenHash = hashPortalToken(rawToken);
  const expiresAt = new Date(
    Date.now() + input.expiresInHours * 60 * 60 * 1000,
  );

  if (input.revokePrevious) {
    await db
      .update(portalAccessTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(portalAccessTokens.processId, processId),
          eq(portalAccessTokens.tenantId, session.tenantId),
          isNull(portalAccessTokens.revokedAt),
        ),
      );
  }

  const [created] = await db
    .insert(portalAccessTokens)
    .values({
      tenantId: process.tenantId,
      processId: process.id,
      tokenHash,
      label: input.label ?? null,
      expiresAt,
      createdByUserId: session.sub,
    })
    .returning();

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "PORTAL_TOKEN_ISSUE",
    entity: "portal_access_token",
    entityId: created.id,
    newValue: {
      processId,
      expiresAt: expiresAt.toISOString(),
      label: input.label ?? null,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return {
    id: created.id,
    token: rawToken,
    path: `/portal/${rawToken}`,
    expiresAt: created.expiresAt,
    processId: created.processId,
  };
}

/**
 * Issues a fresh portal link for outbound notify (WhatsApp/email deep link).
 * Raw token returned once for the message body only.
 */
export async function issuePortalAccessForNotify(input: {
  tenantId: string;
  processId: string;
  createdByUserId: string;
  expiresInHours?: number;
  label?: string;
  correlationId?: string;
}) {
  const rawToken = generateRawPortalToken();
  const tokenHash = hashPortalToken(rawToken);
  const expiresAt = new Date(
    Date.now() + (input.expiresInHours ?? 72) * 60 * 60 * 1000,
  );

  await db
    .update(portalAccessTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(portalAccessTokens.processId, input.processId),
        eq(portalAccessTokens.tenantId, input.tenantId),
        isNull(portalAccessTokens.revokedAt),
      ),
    );

  const [created] = await db
    .insert(portalAccessTokens)
    .values({
      tenantId: input.tenantId,
      processId: input.processId,
      tokenHash,
      label: input.label ?? "notify-deep-link",
      expiresAt,
      createdByUserId: input.createdByUserId,
    })
    .returning();

  await writeAuditLog({
    tenantId: input.tenantId,
    userId: input.createdByUserId,
    action: "PORTAL_TOKEN_ISSUE",
    entity: "portal_access_token",
    entityId: created.id,
    newValue: {
      processId: input.processId,
      expiresAt: expiresAt.toISOString(),
      purpose: "notification_deep_link",
    },
    correlationId: input.correlationId,
  });

  return {
    id: created.id,
    token: rawToken,
    path: `/portal/${rawToken}`,
    expiresAt: created.expiresAt,
  };
}

export async function revokePortalAccess(
  session: SessionPayload,
  processId: string,
  tokenId: string,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  await loadProcessForSession(session, processId);

  const [updated] = await db
    .update(portalAccessTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(portalAccessTokens.id, tokenId),
        eq(portalAccessTokens.processId, processId),
        eq(portalAccessTokens.tenantId, session.tenantId),
        isNull(portalAccessTokens.revokedAt),
      ),
    )
    .returning();

  if (!updated) {
    throw new AppError(404, "Token não encontrado", "PORTAL_TOKEN_NOT_FOUND");
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "PORTAL_TOKEN_REVOKE",
    entity: "portal_access_token",
    entityId: tokenId,
    newValue: { processId, revokedAt: updated.revokedAt?.toISOString() },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return updated;
}

export async function listPortalAccessTokens(
  session: SessionPayload,
  processId: string,
) {
  await loadProcessForSession(session, processId);

  const rows = await db
    .select({
      id: portalAccessTokens.id,
      label: portalAccessTokens.label,
      expiresAt: portalAccessTokens.expiresAt,
      revokedAt: portalAccessTokens.revokedAt,
      lastUsedAt: portalAccessTokens.lastUsedAt,
      createdAt: portalAccessTokens.createdAt,
    })
    .from(portalAccessTokens)
    .where(
      and(
        eq(portalAccessTokens.processId, processId),
        eq(portalAccessTokens.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(portalAccessTokens.createdAt));

  return rows.map((row) => ({
    ...row,
    active:
      !row.revokedAt && row.expiresAt.getTime() > Date.now(),
  }));
}

/**
 * Resolves raw token → valid access record or throws AppError.
 */
export async function resolvePortalAccess(rawToken: string) {
  if (!rawToken || rawToken.length < 20 || rawToken.length > 128) {
    const fail = portalFailureStatus("INVALID");
    throw new AppError(fail.status, fail.message, fail.code);
  }

  const tokenHash = hashPortalToken(rawToken);
  const [row] = await db
    .select()
    .from(portalAccessTokens)
    .where(eq(portalAccessTokens.tokenHash, tokenHash))
    .limit(1);

  const result = evaluatePortalTokenAccess({
    record: row ? toRecord(row) : null,
  });

  if (!result.ok) {
    const fail = portalFailureStatus(result.reason);
    throw new AppError(fail.status, fail.message, fail.code);
  }

  await db
    .update(portalAccessTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(portalAccessTokens.id, result.record.id));

  return result.record;
}
