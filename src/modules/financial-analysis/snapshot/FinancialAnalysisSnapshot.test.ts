import { describe, expect, it } from "vitest";
import {
  buildFinancialAnalysisSnapshot,
  hashSnapshotPayload,
} from "./FinancialAnalysisSnapshot";

describe("FinancialAnalysisSnapshot", () => {
  it("embeds audit fields for dossier display", () => {
    const snap = buildFinancialAnalysisSnapshot({
      processId: "proc-1",
      processNumber: "PF-2026-000001",
      analysisId: "an-1",
      executedAt: new Date("2026-08-20T15:42:00.000Z"),
      documentsConsidered: 3,
      statements: [
        {
          yearMonth: "2026-04",
          periodStart: null,
          periodEnd: null,
          grossCredits: 4800,
          ownTransfers: 0,
          loans: 0,
          refunds: 0,
          validCredits: 4800,
        },
        {
          yearMonth: "2026-05",
          periodStart: null,
          periodEnd: null,
          grossCredits: 8750,
          ownTransfers: 2000,
          loans: 1500,
          refunds: 300,
          validCredits: 4950,
        },
        {
          yearMonth: "2026-06",
          periodStart: null,
          periodEnd: null,
          grossCredits: 5100,
          ownTransfers: 0,
          loans: 0,
          refunds: 0,
          validCredits: 5100,
        },
      ],
      declaredIncome: 2550,
      analyzedIncome: 4950,
      meanIncome: 4950,
      medianIncome: 4950,
      commitments: { rent: 0, debts: 0, cards: 0, other: 0, total: 0 },
      commitmentPct: 25,
      estimatedCapacity: 4950,
      simulation: {
        system: "SAC",
        financedAmount: 240000,
        installment: 2100,
        termMonths: 360,
        annualRatePct: 9.5,
      },
      indicative: "NECESSITA_ANALISE",
      flags: [],
    });

    expect(snap.processNumber).toBe("PF-2026-000001");
    expect(snap.ruleVersion).toBe("rules-v1");
    expect(snap.incomeMethod).toBe("MEDIANA");
    expect(snap.exclusions.ownTransfers).toBe(2000);
    expect(snap.exclusions.loans).toBe(1500);
    expect(snap.exclusions.refunds).toBe(300);
    expect(snap.documentsConsidered).toBe(3);
    expect(snap.statements.map((s) => s.yearMonth)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
    ]);
    expect(hashSnapshotPayload(snap)).toMatch(/^[a-f0-9]{64}$/);
  });
});
