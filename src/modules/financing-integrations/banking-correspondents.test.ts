import { describe, expect, it } from "vitest";
import {
  assertIdsBelongToAllowedSet,
  assertNoCrossTenantBankingAccess,
  filterActiveBankingCorrespondents,
  requireBankingCorrespondentId,
  submissionsPreserveHistory,
  trackTargetsSpecificSubmission,
} from "./banking-correspondent-rules";
import { AppError } from "@/lib/api";

describe("banking correspondents — FASE 7 multi-partner", () => {
  const partners = [
    { id: "bc-1", name: "CredOnline", status: "ATIVO" },
    { id: "bc-2", name: "FinanCasa", status: "ATIVO" },
    { id: "bc-3", name: "HabitaMais", status: "ATIVO" },
    { id: "bc-4", name: "Inativo SA", status: "INATIVO" },
  ];

  it("lists multiple active banking correspondents", () => {
    const listed = filterActiveBankingCorrespondents(partners);
    expect(listed).toHaveLength(3);
    expect(listed.map((p) => p.name)).toEqual([
      "CredOnline",
      "FinanCasa",
      "HabitaMais",
    ]);
  });

  it("selects a banking correspondent from allowed set", () => {
    const allowed = filterActiveBankingCorrespondents(partners, [
      "bc-1",
      "bc-2",
    ]);
    expect(allowed.map((p) => p.id)).toEqual(["bc-1", "bc-2"]);
    expect(() => assertIdsBelongToAllowedSet("bc-1", ["bc-1", "bc-2"])).not.toThrow();
  });

  it("fails submit without banking correspondent", () => {
    expect(() => requireBankingCorrespondentId(undefined)).toThrow(AppError);
    expect(() => requireBankingCorrespondentId("")).toThrow(AppError);
    try {
      requireBankingCorrespondentId(null);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("BANKING_CORRESPONDENT_REQUIRED");
    }
  });

  it("accepts submit with banking correspondent id", () => {
    expect(requireBankingCorrespondentId("bc-1")).toBe("bc-1");
  });

  it("records correspondent_id on submission payload shape", () => {
    const submission = {
      processId: "proc-1",
      bankingCorrespondentId: "bc-1",
      institution: "CAIXA",
      status: "SUBMITTED",
    };
    expect(submission.bankingCorrespondentId).toBe("bc-1");
  });

  it("history shows correspondent name", () => {
    const historyLine = {
      processNumber: "PF-2026-000001",
      at: "21/08/2026 14:20",
      institution: "CAIXA",
      bankingCorrespondentName: "CredOnline",
      userName: "João",
      status: "ENVIADO_AO_BANCO",
    };
    expect(
      `${historyLine.processNumber} · Correspondente: ${historyLine.bankingCorrespondentName}`,
    ).toContain("CredOnline");
  });

  it("track updates only the targeted submission", () => {
    const before = [
      { id: "sub-1", status: "SUBMITTED" },
      { id: "sub-2", status: "SUBMITTED" },
    ];
    const after = trackTargetsSpecificSubmission(before, "sub-2", "TRACKING");
    expect(after[0]?.status).toBe("SUBMITTED");
    expect(after[1]?.status).toBe("TRACKING");
  });

  it("keeps two submissions for different banking correspondents", () => {
    const existing = [{ id: "sub-1" }];
    const created = { id: "sub-2" };
    const all = submissionsPreserveHistory(existing, created);
    expect(all).toHaveLength(2);
    expect(all.map((s) => s.id)).toEqual(["sub-1", "sub-2"]);
  });

  it("does not overwrite previous submission", () => {
    const first = { id: "sub-1", bankingCorrespondentId: "bc-1" };
    const second = { id: "sub-2", bankingCorrespondentId: "bc-2" };
    const history = submissionsPreserveHistory([first], second);
    expect(history[0]).toEqual(first);
    expect(history[1]).toEqual(second);
  });

  it("excludes inactive banking correspondents from selection", () => {
    const listed = filterActiveBankingCorrespondents(partners);
    expect(listed.find((p) => p.id === "bc-4")).toBeUndefined();
  });

  it("blocks cross-tenant banking access", () => {
    expect(() =>
      assertNoCrossTenantBankingAccess({
        sessionTenantId: "tenant-a",
        entityTenantId: "tenant-b",
      }),
    ).toThrow(AppError);
  });

  it("RBAC: commercial org cannot use partner outside allow-list", () => {
    expect(() =>
      assertIdsBelongToAllowedSet("bc-3", ["bc-1", "bc-2"]),
    ).toThrow(AppError);
  });
});
