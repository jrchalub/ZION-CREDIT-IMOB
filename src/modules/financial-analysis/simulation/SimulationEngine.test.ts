import { describe, expect, it } from "vitest";
import { simulateFinancing } from "./SimulationEngine";

describe("simulation engine", () => {
  it("PRICE keeps fixed installment", () => {
    const result = simulateFinancing({
      propertyValue: 300000,
      downPayment: 60000,
      fgtsAmount: 0,
      termMonths: 360,
      annualRatePct: 9.5,
      amortizationSystem: "PRICE",
    });

    expect(result.financedAmount).toBe(240000);
    expect(result.firstInstallment).toBe(result.lastInstallment);
    expect(result.averageInstallment).toBe(result.firstInstallment);
    expect(result.firstInstallment).toBeGreaterThan(0);
    expect(result.totalInterest).toBeGreaterThan(0);
  });

  it("SAC has decreasing installments", () => {
    const result = simulateFinancing({
      propertyValue: 300000,
      downPayment: 60000,
      fgtsAmount: 20000,
      termMonths: 360,
      annualRatePct: 9.5,
      amortizationSystem: "SAC",
    });

    expect(result.financedAmount).toBe(220000);
    expect(result.firstInstallment).toBeGreaterThan(result.lastInstallment);
  });
});
