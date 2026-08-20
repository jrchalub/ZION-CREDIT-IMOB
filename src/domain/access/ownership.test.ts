import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";
import {
  assertProcessOwnedBySession,
  isCorrespondentRole,
} from "./ownership";

function session(
  overrides: Partial<SessionPayload> & Pick<SessionPayload, "role">,
): SessionPayload {
  return {
    sub: "user-1",
    tenantId: "tenant-1",
    email: "a@b.c",
    fullName: "Test",
    correspondentId: "corr-1",
    ...overrides,
  };
}

describe("correspondent ownership", () => {
  it("identifies correspondent role", () => {
    expect(isCorrespondentRole(session({ role: "CORRESPONDENTE" }))).toBe(true);
    expect(isCorrespondentRole(session({ role: "ANALISTA" }))).toBe(false);
  });

  it("allows analyst any process in tenant", () => {
    expect(() =>
      assertProcessOwnedBySession(session({ role: "ANALISTA" }), {
        tenantId: "tenant-1",
        correspondentId: "other",
        createdByUserId: "x",
      }),
    ).not.toThrow();
  });

  it("blocks correspondent from other org process", () => {
    expect(() =>
      assertProcessOwnedBySession(session({ role: "CORRESPONDENTE" }), {
        tenantId: "tenant-1",
        correspondentId: "other-org",
        createdByUserId: "user-1",
      }),
    ).toThrow(AppError);
  });

  it("allows correspondent own org process", () => {
    expect(() =>
      assertProcessOwnedBySession(session({ role: "CORRESPONDENTE" }), {
        tenantId: "tenant-1",
        correspondentId: "corr-1",
        createdByUserId: "other",
      }),
    ).not.toThrow();
  });

  it("falls back to createdBy when correspondentId missing on session", () => {
    expect(() =>
      assertProcessOwnedBySession(
        session({ role: "CORRESPONDENTE", correspondentId: null }),
        {
          tenantId: "tenant-1",
          correspondentId: null,
          createdByUserId: "user-1",
        },
      ),
    ).not.toThrow();

    expect(() =>
      assertProcessOwnedBySession(
        session({ role: "CORRESPONDENTE", correspondentId: null }),
        {
          tenantId: "tenant-1",
          correspondentId: null,
          createdByUserId: "other-user",
        },
      ),
    ).toThrow(AppError);
  });

  it("hides cross-tenant as not found", () => {
    try {
      assertProcessOwnedBySession(session({ role: "CORRESPONDENTE" }), {
        tenantId: "other-tenant",
        correspondentId: "corr-1",
        createdByUserId: "user-1",
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(404);
    }
  });
});
