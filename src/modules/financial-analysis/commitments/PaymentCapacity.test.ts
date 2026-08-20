import { describe, expect, it } from "vitest";
import { computePaymentCapacity } from "./PaymentCapacity";
import { FINANCIAL_DISCLAIMER } from "../constants";

describe("payment capacity", () => {
  it("marks FAVORAVEL when commitment <= 30%", () => {
    const r = computePaymentCapacity({
      analyzedIncome: 5000,
      totalCommitments: 500,
      simulatedInstallment: 1200,
      monthsAnalyzed: 3,
      incomeConfidence: 0.85,
    });
    expect(r.commitmentPct).toBe(24);
    expect(r.indicative).toBe("FAVORAVEL");
    expect(r.estimatedCapacity).toBe(4500);
  });

  it("marks NECESSITA_ANALISE between 30 and 40%", () => {
    const r = computePaymentCapacity({
      analyzedIncome: 5000,
      totalCommitments: 0,
      simulatedInstallment: 1750,
      monthsAnalyzed: 3,
      incomeConfidence: 0.85,
    });
    expect(r.commitmentPct).toBe(35);
    expect(r.indicative).toBe("NECESSITA_ANALISE");
  });

  it("marks DESFAVORAVEL above 40%", () => {
    const r = computePaymentCapacity({
      analyzedIncome: 5000,
      totalCommitments: 0,
      simulatedInstallment: 2500,
      monthsAnalyzed: 3,
      incomeConfidence: 0.85,
    });
    expect(r.indicative).toBe("DESFAVORAVEL");
  });

  it("downgrades FAVORAVEL when few months", () => {
    const r = computePaymentCapacity({
      analyzedIncome: 5000,
      totalCommitments: 0,
      simulatedInstallment: 1000,
      monthsAnalyzed: 1,
      incomeConfidence: 0.85,
    });
    expect(r.indicative).toBe("NECESSITA_ANALISE");
    expect(r.flags).toContain("FEW_STATEMENT_MONTHS");
  });

  it("exposes fixed disclaimer constant", () => {
    expect(FINANCIAL_DISCLAIMER).toContain("pré-análise interna");
    expect(FINANCIAL_DISCLAIMER).toContain("Não representa aprovação");
  });
});
