import { createHash } from "crypto";
import {
  CLASSIFIER_RULES_VERSION,
  FINANCIAL_DISCLAIMER,
  INCOME_METHOD_VERSION,
  type FinancialIndicative,
} from "../constants";

export type FinancialAnalysisSnapshotPayload = {
  schemaVersion: "fas-v1";
  processNumber: string | null;
  processId: string;
  analysisId: string;
  executedAt: string;
  ruleVersion: string;
  incomeMethodVersion: string;
  capacityMethodVersion: string;
  simulationMethodVersion: string;
  documentsConsidered: number;
  statements: Array<{
    yearMonth: string;
    periodStart: string | null;
    periodEnd: string | null;
    grossCredits: number;
    ownTransfers: number;
    loans: number;
    refunds: number;
    validCredits: number;
  }>;
  declaredIncome: number | null;
  analyzedIncome: number | null;
  incomeMethod: "MEDIANA";
  meanIncome: number | null;
  medianIncome: number | null;
  exclusions: {
    ownTransfers: number;
    loans: number;
    refunds: number;
  };
  commitments: {
    rent: number;
    debts: number;
    cards: number;
    other: number;
    total: number;
  };
  commitmentPct: number | null;
  estimatedCapacity: number | null;
  simulation: {
    system: "SAC" | "PRICE" | null;
    financedAmount: number | null;
    installment: number | null;
    termMonths: number | null;
    annualRatePct: number | null;
  };
  indicative: FinancialIndicative | null;
  flags: string[];
  disclaimer: string;
};

export const CAPACITY_METHOD_VERSION = "capacity-v1";
export const SIMULATION_METHOD_VERSION = "simulation-v1";

/**
 * Builds a frozen payload. Callers must persist as-is and never mutate.
 * Changing rules-v2 later must NOT rewrite historical snapshots.
 */
export function buildFinancialAnalysisSnapshot(input: {
  processId: string;
  processNumber: string | null;
  analysisId: string;
  executedAt?: Date;
  documentsConsidered: number;
  statements: FinancialAnalysisSnapshotPayload["statements"];
  declaredIncome: number | null;
  analyzedIncome: number | null;
  meanIncome: number | null;
  medianIncome: number | null;
  commitments: FinancialAnalysisSnapshotPayload["commitments"];
  commitmentPct: number | null;
  estimatedCapacity: number | null;
  simulation: FinancialAnalysisSnapshotPayload["simulation"];
  indicative: FinancialIndicative | null;
  flags: string[];
}): FinancialAnalysisSnapshotPayload {
  const exclusions = {
    ownTransfers: round2(
      input.statements.reduce((a, s) => a + s.ownTransfers, 0),
    ),
    loans: round2(input.statements.reduce((a, s) => a + s.loans, 0)),
    refunds: round2(input.statements.reduce((a, s) => a + s.refunds, 0)),
  };

  return {
    schemaVersion: "fas-v1",
    processNumber: input.processNumber,
    processId: input.processId,
    analysisId: input.analysisId,
    executedAt: (input.executedAt ?? new Date()).toISOString(),
    ruleVersion: CLASSIFIER_RULES_VERSION,
    incomeMethodVersion: INCOME_METHOD_VERSION,
    capacityMethodVersion: CAPACITY_METHOD_VERSION,
    simulationMethodVersion: SIMULATION_METHOD_VERSION,
    documentsConsidered: input.documentsConsidered,
    statements: input.statements,
    declaredIncome: input.declaredIncome,
    analyzedIncome: input.analyzedIncome,
    incomeMethod: "MEDIANA",
    meanIncome: input.meanIncome,
    medianIncome: input.medianIncome,
    exclusions,
    commitments: input.commitments,
    commitmentPct: input.commitmentPct,
    estimatedCapacity: input.estimatedCapacity,
    simulation: input.simulation,
    indicative: input.indicative,
    flags: [...input.flags],
    disclaimer: FINANCIAL_DISCLAIMER,
  };
}

export function hashSnapshotPayload(
  payload: FinancialAnalysisSnapshotPayload,
): string {
  // Stable JSON: sort keys recursively for deterministic hash
  const canonical = JSON.stringify(sortKeys(payload));
  return createHash("sha256").update(canonical).digest("hex");
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeys(obj[key]);
    }
    return out;
  }
  return value;
}
