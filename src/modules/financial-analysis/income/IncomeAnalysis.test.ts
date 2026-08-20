import { describe, expect, it } from "vitest";
import { analyzeIncome, buildMonthRolls, median, mean } from "./IncomeAnalysis";
import type { TxForIncome } from "./IncomeAnalysis";

describe("income analysis", () => {
  it("excludes own transfers, loans and refunds from May example", () => {
    const txs: TxForIncome[] = [
      {
        amount: 4950,
        direction: "CREDIT",
        category: "INCOME_PROBABLE",
        yearMonth: "2026-05",
      },
      {
        amount: 2000,
        direction: "CREDIT",
        category: "OWN_TRANSFER",
        yearMonth: "2026-05",
      },
      {
        amount: 1500,
        direction: "CREDIT",
        category: "LOAN",
        yearMonth: "2026-05",
      },
      {
        amount: 300,
        direction: "CREDIT",
        category: "REFUND",
        yearMonth: "2026-05",
      },
    ];

    const rolls = buildMonthRolls(txs);
    expect(rolls).toHaveLength(1);
    expect(rolls[0]!.grossCredits).toBe(8750);
    expect(rolls[0]!.ownTransfers).toBe(2000);
    expect(rolls[0]!.loans).toBe(1500);
    expect(rolls[0]!.refunds).toBe(300);
    expect(rolls[0]!.validCredits).toBe(4950);
  });

  it("uses median as estimated income across months", () => {
    const txs: TxForIncome[] = [
      {
        amount: 4800,
        direction: "CREDIT",
        category: "INCOME_PROBABLE",
        yearMonth: "2026-04",
      },
      {
        amount: 4950,
        direction: "CREDIT",
        category: "INCOME_PROBABLE",
        yearMonth: "2026-05",
      },
      {
        amount: 5100,
        direction: "CREDIT",
        category: "INCOME_PROBABLE",
        yearMonth: "2026-06",
      },
    ];

    const result = analyzeIncome(txs);
    expect(result.meanIncome).toBe(4950);
    expect(result.medianIncome).toBe(4950);
    expect(result.estimatedIncome).toBe(4950);
    expect(result.monthsAnalyzed).toBe(3);
  });

  it("computes median correctly for even counts", () => {
    expect(median([100, 200, 300, 400])).toBe(250);
    expect(mean([100, 200, 300])).toBe(200);
  });
});
