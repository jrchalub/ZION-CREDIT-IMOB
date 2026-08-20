import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** High-entropy raw token for URL path (never persisted). */
export function generateRawPortalToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPortalToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function portalTokensEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export type PortalTokenRecord = {
  id: string;
  tenantId: string;
  processId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type PortalTokenValidationFailure =
  | "INVALID"
  | "EXPIRED"
  | "REVOKED"
  | "PROCESS_MISMATCH"
  | "TENANT_MISMATCH";

/**
 * Pure validation against a stored row (no DB).
 * Caller must look up by hash first; mismatch → INVALID.
 */
export function evaluatePortalTokenAccess(input: {
  record: PortalTokenRecord | null;
  expectedProcessId?: string;
  expectedTenantId?: string;
  now?: Date;
}): { ok: true; record: PortalTokenRecord } | { ok: false; reason: PortalTokenValidationFailure } {
  const now = input.now ?? new Date();
  if (!input.record) return { ok: false, reason: "INVALID" };

  if (input.record.revokedAt) return { ok: false, reason: "REVOKED" };
  if (input.record.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "EXPIRED" };
  }
  if (
    input.expectedProcessId &&
    input.record.processId !== input.expectedProcessId
  ) {
    return { ok: false, reason: "PROCESS_MISMATCH" };
  }
  if (
    input.expectedTenantId &&
    input.record.tenantId !== input.expectedTenantId
  ) {
    return { ok: false, reason: "TENANT_MISMATCH" };
  }

  return { ok: true, record: input.record };
}

export function portalFailureStatus(reason: PortalTokenValidationFailure): {
  status: number;
  message: string;
  code: string;
} {
  switch (reason) {
    case "EXPIRED":
      return {
        status: 401,
        message: "Link expirado",
        code: "PORTAL_TOKEN_EXPIRED",
      };
    case "REVOKED":
      return {
        status: 401,
        message: "Link revogado",
        code: "PORTAL_TOKEN_REVOKED",
      };
    case "PROCESS_MISMATCH":
    case "TENANT_MISMATCH":
      return {
        status: 404,
        message: "Acesso não encontrado",
        code: "PORTAL_ACCESS_NOT_FOUND",
      };
    default:
      return {
        status: 401,
        message: "Link inválido",
        code: "PORTAL_TOKEN_INVALID",
      };
  }
}
