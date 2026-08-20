import { describe, expect, it } from "vitest";
import { classifyTransaction } from "../classifier/rules-v1";
import { computePaymentCapacity } from "../commitments/PaymentCapacity";
import {
  CLASSIFIER_RULES_VERSION,
  FINANCIAL_DISCLAIMER,
} from "../constants";
import { analyzeIncome, type TxForIncome } from "../income/IncomeAnalysis";
import { simulateFinancing } from "../simulation/SimulationEngine";
import {
  buildFinancialAnalysisSnapshot,
  hashSnapshotPayload,
} from "./FinancialAnalysisSnapshot";

function credit(
  amount: number,
  category: TxForIncome["category"],
  yearMonth: string,
  description?: string,
): TxForIncome {
  return { amount, direction: "CREDIT", category, yearMonth };
}

function debit(
  amount: number,
  category: TxForIncome["category"],
  yearMonth: string,
): TxForIncome {
  return { amount, direction: "DEBIT", category, yearMonth };
}

describe("FASE 4 hardening scenarios", () => {
  it("1. excludes own transfers from valid credits", () => {
    const r = analyzeIncome([
      credit(5000, "INCOME_PROBABLE", "2026-05"),
      credit(2000, "OWN_TRANSFER", "2026-05"),
    ]);
    expect(r.months[0]!.validCredits).toBe(5000);
    expect(r.exclusions.some((e) => e.category === "OWN_TRANSFER")).toBe(true);
  });

  it("2. excludes received loans", () => {
    const r = analyzeIncome([
      credit(4000, "SALARY", "2026-05"),
      credit(1500, "LOAN", "2026-05"),
    ]);
    expect(r.months[0]!.validCredits).toBe(4000);
    expect(r.months[0]!.loans).toBe(1500);
  });

  it("3. excludes refunds/estornos", () => {
    const r = analyzeIncome([
      credit(3000, "INCOME_PROBABLE", "2026-05"),
      credit(300, "REFUND", "2026-05"),
    ]);
    expect(r.months[0]!.validCredits).toBe(3000);
    expect(r.months[0]!.refunds).toBe(300);
  });

  it("4. recurrent income has high recurrence score", () => {
    const r = analyzeIncome([
      credit(5000, "SALARY", "2026-04"),
      credit(5050, "SALARY", "2026-05"),
      credit(4950, "SALARY", "2026-06"),
    ]);
    expect(r.recurrenceScore).toBeGreaterThanOrEqual(0.8);
    expect(r.estimatedIncome).toBe(5000);
  });

  it("5. highly variable income lowers confidence / flags variation", () => {
    const r = analyzeIncome([
      credit(2000, "INCOME_PROBABLE", "2026-04"),
      credit(8000, "INCOME_PROBABLE", "2026-05"),
      credit(3000, "INCOME_PROBABLE", "2026-06"),
    ]);
    expect(r.variationPct).toBeGreaterThan(40);
    expect(r.confidence).toBeLessThan(0.85);
    expect(r.estimatedIncome).toBe(3000); // median
  });

  it("6. single month requires analysis flag path", () => {
    const r = analyzeIncome([credit(4950, "INCOME_PROBABLE", "2026-05")]);
    expect(r.monthsAnalyzed).toBe(1);
    const capacity = computePaymentCapacity({
      analyzedIncome: r.estimatedIncome,
      totalCommitments: 0,
      simulatedInstallment: 1000,
      monthsAnalyzed: r.monthsAnalyzed,
      incomeConfidence: r.confidence,
    });
    expect(capacity.flags).toContain("FEW_STATEMENT_MONTHS");
    expect(capacity.indicative).toBe("NECESSITA_ANALISE");
  });

  it("7. three complete months — May example + neighbors", () => {
    const r = analyzeIncome([
      credit(4800, "INCOME_PROBABLE", "2026-04"),
      credit(4950, "INCOME_PROBABLE", "2026-05"),
      credit(2000, "OWN_TRANSFER", "2026-05"),
      credit(1500, "LOAN", "2026-05"),
      credit(300, "REFUND", "2026-05"),
      credit(5100, "INCOME_PROBABLE", "2026-06"),
    ]);
    expect(r.monthsAnalyzed).toBe(3);
    expect(r.months.find((m) => m.yearMonth === "2026-05")!.validCredits).toBe(
      4950,
    );
    expect(r.meanIncome).toBe(4950);
    expect(r.medianIncome).toBe(4950);
    expect(r.estimatedIncome).toBe(4950);
  });

  it("8. duplicate statement month does not invent income method", () => {
    // Same month merged into one roll — deterministic aggregation
    const r = analyzeIncome([
      credit(4950, "INCOME_PROBABLE", "2026-05"),
      credit(4950, "INCOME_PROBABLE", "2026-05"), // duplicate upload same month
    ]);
    expect(r.months).toHaveLength(1);
    expect(r.months[0]!.grossCredits).toBe(9900);
    // Orchestrator skips duplicateOfDocumentId; pure engine merges by month
  });

  it("9. unclassified → default credit/debit categories", () => {
    const unknownCredit = classifyTransaction({
      description: "XYZ123 lancamento",
      direction: "CREDIT",
    });
    expect(unknownCredit.category).toBe("INCOME_PROBABLE");
    const unknownDebit = classifyTransaction({
      description: "XYZ123 lancamento",
      direction: "DEBIT",
    });
    expect(unknownDebit.category).toBe("EXPENSE");
  });

  it("10. negative balance does not invent income (debits ignored for credits)", () => {
    const r = analyzeIncome([
      credit(1000, "INCOME_PROBABLE", "2026-05"),
      debit(5000, "EXPENSE", "2026-05"),
    ]);
    expect(r.months[0]!.validCredits).toBe(1000);
    expect(r.estimatedIncome).toBe(1000);
  });

  it("11. elevated card invoice raises commitments", () => {
    const income = 5000;
    const cards = 2800;
    const capacity = computePaymentCapacity({
      analyzedIncome: income,
      totalCommitments: cards,
      simulatedInstallment: 900,
      monthsAnalyzed: 3,
      incomeConfidence: 0.85,
    });
    expect(capacity.estimatedCapacity).toBe(2200);
    expect(capacity.commitmentPct).toBe(18);
  });

  it("12. manual debts reduce capacity", () => {
    const capacity = computePaymentCapacity({
      analyzedIncome: 5000,
      totalCommitments: 1200, // debts + rent
      simulatedInstallment: 1000,
      monthsAnalyzed: 3,
      incomeConfidence: 0.9,
    });
    expect(capacity.estimatedCapacity).toBe(3800);
  });

  it("13. declared vs bank income diverge — snapshot keeps both", () => {
    const snap = buildFinancialAnalysisSnapshot({
      processId: "p1",
      processNumber: "PF-2026-000001",
      analysisId: "a1",
      documentsConsidered: 3,
      statements: [
        {
          yearMonth: "2026-05",
          periodStart: "2026-05-01",
          periodEnd: "2026-05-31",
          grossCredits: 8750,
          ownTransfers: 2000,
          loans: 1500,
          refunds: 300,
          validCredits: 4950,
        },
      ],
      declaredIncome: 2550,
      analyzedIncome: 4950,
      meanIncome: 4950,
      medianIncome: 4950,
      commitments: { rent: 0, debts: 0, cards: 420, other: 0, total: 420 },
      commitmentPct: 20,
      estimatedCapacity: 4530,
      simulation: {
        system: "PRICE",
        financedAmount: 200000,
        installment: 990,
        termMonths: 360,
        annualRatePct: 9.5,
      },
      indicative: "FAVORAVEL",
      flags: [],
    });
    expect(snap.declaredIncome).toBe(2550);
    expect(snap.analyzedIncome).toBe(4950);
    expect(snap.declaredIncome).not.toBe(snap.analyzedIncome);
    expect(snap.incomeMethod).toBe("MEDIANA");
  });

  it("14. human classification override is respected as input category", () => {
    // Engine uses category already set (human override path feeds category)
    const r = analyzeIncome([
      credit(2000, "OWN_TRANSFER", "2026-05"), // human marked as own transfer
      credit(3000, "INCOME_PROBABLE", "2026-05"),
    ]);
    expect(r.months[0]!.validCredits).toBe(3000);
  });

  it("15. reprocess yields deterministic snapshot hash for same inputs", () => {
    const base = {
      processId: "p1",
      processNumber: "PF-2026-000001",
      analysisId: "a1",
      executedAt: new Date("2026-08-20T15:42:00.000Z"),
      documentsConsidered: 3,
      statements: [
        {
          yearMonth: "2026-04",
          periodStart: "2026-04-01",
          periodEnd: "2026-04-30",
          grossCredits: 4800,
          ownTransfers: 0,
          loans: 0,
          refunds: 0,
          validCredits: 4800,
        },
        {
          yearMonth: "2026-05",
          periodStart: "2026-05-01",
          periodEnd: "2026-05-31",
          grossCredits: 8750,
          ownTransfers: 2000,
          loans: 1500,
          refunds: 300,
          validCredits: 4950,
        },
        {
          yearMonth: "2026-06",
          periodStart: "2026-06-01",
          periodEnd: "2026-06-30",
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
      commitments: { rent: 0, debts: 200, cards: 420, other: 0, total: 620 },
      commitmentPct: 22.5,
      estimatedCapacity: 4330,
      simulation: {
        system: "SAC" as const,
        financedAmount: 240000,
        installment: 2100,
        termMonths: 360,
        annualRatePct: 9.5,
      },
      indicative: "NECESSITA_ANALISE" as const,
      flags: [] as string[],
    };

    const a = buildFinancialAnalysisSnapshot(base);
    const b = buildFinancialAnalysisSnapshot(base);
    expect(hashSnapshotPayload(a)).toBe(hashSnapshotPayload(b));
    expect(a.ruleVersion).toBe(CLASSIFIER_RULES_VERSION);
    expect(a.disclaimer).toBe(FINANCIAL_DISCLAIMER);

    // Different analysisId = different run, but same ruleVersion preserved on each
    const c = buildFinancialAnalysisSnapshot({ ...base, analysisId: "a2" });
    expect(c.ruleVersion).toBe("rules-v1");
    expect(hashSnapshotPayload(c)).not.toBe(hashSnapshotPayload(a));
  });

  it("immutable snapshot freezes ruleVersion independently of future rules", () => {
    const snap = buildFinancialAnalysisSnapshot({
      processId: "p1",
      processNumber: "PF-2026-000001",
      analysisId: "a1",
      documentsConsidered: 1,
      statements: [],
      declaredIncome: 2550,
      analyzedIncome: null,
      meanIncome: null,
      medianIncome: null,
      commitments: { rent: 0, debts: 0, cards: 0, other: 0, total: 0 },
      commitmentPct: null,
      estimatedCapacity: null,
      simulation: {
        system: null,
        financedAmount: null,
        installment: null,
        termMonths: null,
        annualRatePct: null,
      },
      indicative: "DESFAVORAVEL",
      flags: ["NO_BANK_STATEMENTS"],
    });
    // Historical snapshot must keep rules-v1 even if code later adds rules-v2
    expect(snap.ruleVersion).toBe("rules-v1");
    expect(snap.incomeMethodVersion).toBe("income-v1");
    const frozen = structuredClone(snap);
    expect(frozen.ruleVersion).toBe(snap.ruleVersion);
  });

  it("SAC simulation remains deterministic", () => {
    const a = simulateFinancing({
      propertyValue: 300000,
      downPayment: 60000,
      fgtsAmount: 0,
      termMonths: 360,
      annualRatePct: 9.5,
      amortizationSystem: "SAC",
    });
    const b = simulateFinancing({
      propertyValue: 300000,
      downPayment: 60000,
      fgtsAmount: 0,
      termMonths: 360,
      annualRatePct: 9.5,
      amortizationSystem: "SAC",
    });
    expect(a.firstInstallment).toBe(b.firstInstallment);
    expect(a.lastInstallment).toBe(b.lastInstallment);
  });
});
