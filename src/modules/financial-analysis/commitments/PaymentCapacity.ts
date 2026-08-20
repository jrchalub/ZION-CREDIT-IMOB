import type { FinancialIndicative } from "../constants";

export type CapacityInput = {
  analyzedIncome: number | null;
  totalCommitments: number;
  simulatedInstallment: number | null;
  monthsAnalyzed: number;
  incomeConfidence: number;
  criticalFlags?: string[];
};

export type CapacityResult = {
  analyzedIncome: number | null;
  totalCommitments: number;
  simulatedInstallment: number | null;
  estimatedCapacity: number | null;
  commitmentPct: number | null;
  indicative: FinancialIndicative;
  flags: string[];
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Thresholds (internal pré-análise — never bank approval):
 * FAVORAVEL ≤ 30% | NECESSITA_ANALISE 30–40% | DESFAVORAVEL > 40%
 */
export function computePaymentCapacity(input: CapacityInput): CapacityResult {
  const flags = [...(input.criticalFlags ?? [])];
  const income = input.analyzedIncome;
  const installment = input.simulatedInstallment;

  if (income === null || income <= 0) {
    flags.push("NO_ANALYZED_INCOME");
    return {
      analyzedIncome: income,
      totalCommitments: round2(input.totalCommitments),
      simulatedInstallment: installment,
      estimatedCapacity: null,
      commitmentPct: null,
      indicative: "DESFAVORAVEL",
      flags,
    };
  }

  if (input.monthsAnalyzed < 2) flags.push("FEW_STATEMENT_MONTHS");
  if (input.incomeConfidence < 0.7) flags.push("LOW_INCOME_CONFIDENCE");

  const estimatedCapacity = round2(
    Math.max(0, income - input.totalCommitments),
  );

  let commitmentPct: number | null = null;
  if (installment !== null && installment > 0) {
    commitmentPct = round2((installment / income) * 100);
  } else {
    flags.push("NO_SIMULATED_INSTALLMENT");
  }

  let indicative: FinancialIndicative = "NECESSITA_ANALISE";
  if (commitmentPct === null) {
    indicative = "NECESSITA_ANALISE";
  } else if (commitmentPct > 40) {
    indicative = "DESFAVORAVEL";
  } else if (commitmentPct > 30) {
    indicative = "NECESSITA_ANALISE";
  } else {
    indicative = "FAVORAVEL";
  }

  if (
    indicative === "FAVORAVEL" &&
    (flags.includes("FEW_STATEMENT_MONTHS") ||
      flags.includes("LOW_INCOME_CONFIDENCE") ||
      flags.includes("CRITICAL_INCONSISTENCY"))
  ) {
    indicative = "NECESSITA_ANALISE";
  }

  return {
    analyzedIncome: round2(income),
    totalCommitments: round2(input.totalCommitments),
    simulatedInstallment: installment !== null ? round2(installment) : null,
    estimatedCapacity,
    commitmentPct,
    indicative,
    flags,
  };
}
