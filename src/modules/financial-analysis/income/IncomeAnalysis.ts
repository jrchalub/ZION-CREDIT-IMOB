import {
  INCOME_EXCLUSION_CATEGORIES,
  INCOME_METHOD_VERSION,
  type TransactionCategory,
} from "../constants";

export type TxForIncome = {
  amount: number;
  direction: "CREDIT" | "DEBIT" | null;
  category: TransactionCategory;
  yearMonth: string;
  bankStatementId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
};

export type MonthRoll = {
  yearMonth: string;
  periodStart: string | null;
  periodEnd: string | null;
  bankStatementId: string | null;
  grossCredits: number;
  ownTransfers: number;
  loans: number;
  refunds: number;
  otherExclusions: number;
  validCredits: number;
};

export type IncomeAnalysisResult = {
  methodVersion: string;
  months: MonthRoll[];
  meanIncome: number | null;
  medianIncome: number | null;
  minIncome: number | null;
  maxIncome: number | null;
  estimatedIncome: number | null;
  variationPct: number | null;
  recurrenceScore: number | null;
  confidence: number;
  monthsAnalyzed: number;
  exclusions: Array<{ category: string; amount: number; month?: string }>;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return round2((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return round2(sorted[mid]!);
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Builds monthly valid-credit rolls:
 * gross credits − own transfers − loans − refunds = valid credits
 */
export function buildMonthRolls(transactions: TxForIncome[]): MonthRoll[] {
  const byMonth = new Map<
    string,
    {
      periodStart: string | null;
      periodEnd: string | null;
      bankStatementId: string | null;
      txs: TxForIncome[];
    }
  >();

  for (const tx of transactions) {
    const key = tx.yearMonth;
    const bucket = byMonth.get(key) ?? {
      periodStart: tx.periodStart ?? null,
      periodEnd: tx.periodEnd ?? null,
      bankStatementId: tx.bankStatementId ?? null,
      txs: [],
    };
    bucket.txs.push(tx);
    if (tx.periodStart) bucket.periodStart = tx.periodStart;
    if (tx.periodEnd) bucket.periodEnd = tx.periodEnd;
    if (tx.bankStatementId) bucket.bankStatementId = tx.bankStatementId;
    byMonth.set(key, bucket);
  }

  const rolls: MonthRoll[] = [];
  for (const [yearMonth, bucket] of [...byMonth.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    let grossCredits = 0;
    let ownTransfers = 0;
    let loans = 0;
    let refunds = 0;
    let otherExclusions = 0;

    for (const tx of bucket.txs) {
      if (tx.direction !== "CREDIT") continue;
      const amount = Math.abs(tx.amount);
      grossCredits += amount;
      if (tx.category === "OWN_TRANSFER") ownTransfers += amount;
      else if (tx.category === "LOAN") loans += amount;
      else if (tx.category === "REFUND") refunds += amount;
      else if (INCOME_EXCLUSION_CATEGORIES.has(tx.category)) {
        otherExclusions += amount;
      }
    }

    const validCredits = round2(
      Math.max(0, grossCredits - ownTransfers - loans - refunds - otherExclusions),
    );

    rolls.push({
      yearMonth,
      periodStart: bucket.periodStart,
      periodEnd: bucket.periodEnd,
      bankStatementId: bucket.bankStatementId,
      grossCredits: round2(grossCredits),
      ownTransfers: round2(ownTransfers),
      loans: round2(loans),
      refunds: round2(refunds),
      otherExclusions: round2(otherExclusions),
      validCredits,
    });
  }

  return rolls;
}

export function analyzeIncome(transactions: TxForIncome[]): IncomeAnalysisResult {
  const months = buildMonthRolls(transactions);
  const valid = months.map((m) => m.validCredits);
  const meanIncome = mean(valid);
  const medianIncome = median(valid);
  const minIncome = valid.length ? round2(Math.min(...valid)) : null;
  const maxIncome = valid.length ? round2(Math.max(...valid)) : null;

  // Default analyzed income = median (defensible vs outliers)
  const estimatedIncome = medianIncome;

  let variationPct: number | null = null;
  if (meanIncome && meanIncome > 0 && minIncome !== null && maxIncome !== null) {
    variationPct = round2(((maxIncome - minIncome) / meanIncome) * 100);
  }

  // Simple recurrence: share of months within 20% of median
  let recurrenceScore: number | null = null;
  if (medianIncome && medianIncome > 0 && valid.length > 0) {
    const stable = valid.filter(
      (v) => Math.abs(v - medianIncome) / medianIncome <= 0.2,
    ).length;
    recurrenceScore = round2(stable / valid.length);
  }

  let confidence = 0.4;
  if (valid.length >= 3) confidence = 0.85;
  else if (valid.length === 2) confidence = 0.7;
  else if (valid.length === 1) confidence = 0.55;
  if (variationPct !== null && variationPct > 40) confidence = Math.max(0.4, confidence - 0.15);
  if (recurrenceScore !== null && recurrenceScore >= 0.8) {
    confidence = Math.min(0.95, confidence + 0.05);
  }

  const exclusions: Array<{ category: string; amount: number; month?: string }> = [];
  for (const m of months) {
    if (m.ownTransfers > 0) {
      exclusions.push({
        category: "OWN_TRANSFER",
        amount: m.ownTransfers,
        month: m.yearMonth,
      });
    }
    if (m.loans > 0) {
      exclusions.push({ category: "LOAN", amount: m.loans, month: m.yearMonth });
    }
    if (m.refunds > 0) {
      exclusions.push({ category: "REFUND", amount: m.refunds, month: m.yearMonth });
    }
  }

  return {
    methodVersion: INCOME_METHOD_VERSION,
    months,
    meanIncome,
    medianIncome,
    minIncome,
    maxIncome,
    estimatedIncome,
    variationPct,
    recurrenceScore,
    confidence: round2(confidence),
    monthsAnalyzed: months.length,
    exclusions,
  };
}
