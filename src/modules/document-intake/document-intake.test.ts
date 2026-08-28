import { describe, expect, it } from "vitest";
import { competenceFromPeriod, monthCoverage, referenceMonths } from "./periods";
import { decideOrganizeAction } from "./organize-rules";
import {
  deriveDocumentationStatus,
  statementPeriodSummary,
} from "./completeness-rules";
import { assertSameTenant } from "./attendance-rules";
import { hasPermission } from "@/domain/rbac/permissions";
import { AppError } from "@/lib/api";

describe("document intake — batch defaults", () => {
  it("creates N inbox rows without checklistItemId and N jobs", () => {
    const files = ["rg.pdf", "cpf.pdf", "extrato-jan.pdf"];
    const rows = files.map((name, index) => ({
      id: `doc-${index}`,
      originalFilename: name,
      checklistItemId: null as string | null,
      metadata: { intake: "inbox" },
    }));
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.checklistItemId === null)).toBe(true);
    expect(rows.every((row) => row.metadata.intake === "inbox")).toBe(true);
    const jobs = rows.map((row) => ({ documentId: row.id }));
    expect(jobs).toHaveLength(3);
  });
});

describe("document organizer decisions", () => {
  it("organizes AUTO_SUGGESTED known type", () => {
    expect(
      decideOrganizeAction({
        decision: "AUTO_SUGGESTED",
        matchedTypeCode: "RG_CPF",
      }),
    ).toEqual({ action: "organize", typeCode: "RG_CPF" });
  });

  it("does not invent type on low confidence", () => {
    expect(
      decideOrganizeAction({
        decision: "LOW_CONFIDENCE",
        matchedTypeCode: "RG_CPF",
      }),
    ).toEqual({ action: "review", reason: "LOW_CONFIDENCE" });
  });

  it("sends unknown type to human review", () => {
    expect(
      decideOrganizeAction({
        decision: "AUTO_SUGGESTED",
        matchedTypeCode: null,
      }),
    ).toEqual({ action: "review", reason: "UNKNOWN_TYPE" });
  });

  it("accepts human selected type", () => {
    expect(
      decideOrganizeAction({
        decision: "LOW_CONFIDENCE",
        matchedTypeCode: null,
        humanSelectedTypeCode: "CTPS_DIGITAL",
      }),
    ).toEqual({ action: "organize", typeCode: "CTPS_DIGITAL" });
  });
});

describe("period coverage", () => {
  it("flags missing month as pendency", () => {
    const required = ["2026-01", "2026-02", "2026-03"];
    const summary = statementPeriodSummary({
      requiredMonths: required,
      presentMonths: ["2026-01", "2026-02"],
    });
    expect(summary.complete).toBe(false);
    expect(summary.missing).toEqual(["2026-03"]);
    expect(summary.headline).toMatch(/março/i);
  });

  it("marks three months complete", () => {
    const required = ["2026-01", "2026-02", "2026-03"];
    const summary = statementPeriodSummary({
      requiredMonths: required,
      presentMonths: required,
    });
    expect(summary.complete).toBe(true);
    expect(summary.headline).toMatch(/COMPLETO/);
  });

  it("parses period end into competence", () => {
    expect(competenceFromPeriod("2026-03-31")).toBe("2026-03");
    expect(competenceFromPeriod("31/03/2026")).toBe("2026-03");
  });

  it("uses last N complete months", () => {
    const months = referenceMonths(3, new Date(2026, 3, 15));
    expect(months).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(monthCoverage(months, months).complete).toBe(true);
  });
});

describe("documentation completeness status", () => {
  it("warns expired as incomplete", () => {
    expect(
      deriveDocumentationStatus({
        requiredOk: true,
        unidentifiedCount: 0,
        expiredCount: 1,
        missingPeriodCount: 0,
      }),
    ).toBe("INCOMPLETA");
  });

  it("waits for unidentified review", () => {
    expect(
      deriveDocumentationStatus({
        requiredOk: true,
        unidentifiedCount: 1,
        expiredCount: 0,
        missingPeriodCount: 0,
      }),
    ).toBe("AGUARDANDO_REVISAO");
  });

  it("approves for analysis when complete", () => {
    expect(
      deriveDocumentationStatus({
        requiredOk: true,
        unidentifiedCount: 0,
        expiredCount: 0,
        missingPeriodCount: 0,
      }),
    ).toBe("APROVADA_PARA_ANALISE");
  });
});

describe("attendance tenant isolation", () => {
  it("blocks cross-tenant patch", () => {
    expect(() =>
      assertSameTenant("tenant-a", "tenant-b"),
    ).toThrow(AppError);
  });

  it("allows same tenant", () => {
    expect(() => assertSameTenant("tenant-a", "tenant-a")).not.toThrow();
  });
});

describe("RBAC intake permissions", () => {
  it("requires documents:write for inbox upload", () => {
    expect(hasPermission("ANALISTA", "documents:write")).toBe(true);
    expect(hasPermission("OPERADOR", "documents:write")).toBe(true);
    expect(hasPermission("CLIENTE", "documents:write")).toBe(true);
    expect(hasPermission("CLIENTE", "processes:write")).toBe(false);
  });
});
