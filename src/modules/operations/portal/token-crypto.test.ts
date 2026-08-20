import { describe, expect, it } from "vitest";
import {
  evaluatePortalTokenAccess,
  generateRawPortalToken,
  hashPortalToken,
  portalFailureStatus,
  portalTokensEqual,
} from "./token-crypto";

describe("portal token crypto", () => {
  it("generates high-entropy opaque tokens without PII", () => {
    const a = generateRawPortalToken();
    const b = generateRawPortalToken();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).not.toMatch(/\d{11}/); // no CPF-like
  });

  it("hashes deterministically and does not equal raw", () => {
    const raw = generateRawPortalToken();
    const h1 = hashPortalToken(raw);
    const h2 = hashPortalToken(raw);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(raw);
    expect(h1).toHaveLength(64);
  });

  it("compares hashes in constant-time fashion", () => {
    const h = hashPortalToken("abc");
    expect(portalTokensEqual(h, h)).toBe(true);
    expect(portalTokensEqual(h, hashPortalToken("xyz"))).toBe(false);
  });
});

describe("portal token validation", () => {
  const base = {
    id: "tok-1",
    tenantId: "tenant-a",
    processId: "proc-a",
    tokenHash: "hash",
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null as Date | null,
  };

  it("accepts valid token", () => {
    const result = evaluatePortalTokenAccess({ record: base });
    expect(result.ok).toBe(true);
  });

  it("rejects missing / invalid", () => {
    const result = evaluatePortalTokenAccess({ record: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID");
  });

  it("rejects expired", () => {
    const result = evaluatePortalTokenAccess({
      record: { ...base, expiresAt: new Date(Date.now() - 1000) },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("EXPIRED");
  });

  it("rejects revoked", () => {
    const result = evaluatePortalTokenAccess({
      record: { ...base, revokedAt: new Date() },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("REVOKED");
  });

  it("rejects process mismatch (isolation)", () => {
    const result = evaluatePortalTokenAccess({
      record: base,
      expectedProcessId: "proc-other",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("PROCESS_MISMATCH");
  });

  it("rejects tenant mismatch (cross-tenant)", () => {
    const result = evaluatePortalTokenAccess({
      record: base,
      expectedTenantId: "tenant-b",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("TENANT_MISMATCH");
  });

  it("maps failure codes for API", () => {
    expect(portalFailureStatus("EXPIRED").code).toBe("PORTAL_TOKEN_EXPIRED");
    expect(portalFailureStatus("REVOKED").code).toBe("PORTAL_TOKEN_REVOKED");
    expect(portalFailureStatus("INVALID").status).toBe(401);
  });
});
