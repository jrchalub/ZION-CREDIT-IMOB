import { createHash } from "crypto";
import {
  CREDIT_SUPPORT_DISCLAIMER,
  CREDIT_SUPPORT_RULES_VERSION,
  CREDIT_SUPPORT_VERSION,
  type DecisionIndicative,
  type ExplainableFactor,
  type MatrixRow,
} from "../constants";

export type DecisionSupportPayload = {
  schemaVersion: "cds-v1";
  processId: string;
  processNumber: string | null;
  financialSnapshotId: string | null;
  rulesVersion: string;
  version: string;
  indicativeResult: DecisionIndicative;
  matrix: MatrixRow[];
  factors: ExplainableFactor[];
  summary: {
    documentationPct: number;
    consistencyScore: number | null;
    openPendencies: number;
    declaredIncome: number | null;
    analyzedIncome: number | null;
    commitmentPct: number | null;
  };
  disclaimer: string;
  executedAt: string;
  autoApprovalDisabled: true;
};

export function buildDecisionSupportPayload(input: {
  processId: string;
  processNumber: string | null;
  financialSnapshotId: string | null;
  indicativeResult: DecisionIndicative;
  matrix: MatrixRow[];
  factors: ExplainableFactor[];
  summary: DecisionSupportPayload["summary"];
  executedAt?: Date;
}): DecisionSupportPayload {
  return {
    schemaVersion: "cds-v1",
    processId: input.processId,
    processNumber: input.processNumber,
    financialSnapshotId: input.financialSnapshotId,
    rulesVersion: CREDIT_SUPPORT_RULES_VERSION,
    version: CREDIT_SUPPORT_VERSION,
    indicativeResult: input.indicativeResult,
    matrix: input.matrix,
    factors: input.factors,
    summary: input.summary,
    disclaimer: CREDIT_SUPPORT_DISCLAIMER,
    executedAt: (input.executedAt ?? new Date()).toISOString(),
    autoApprovalDisabled: true,
  };
}

export function hashDecisionSupportPayload(
  payload: DecisionSupportPayload,
): string {
  const canonical = JSON.stringify(sortKeys(payload));
  return createHash("sha256").update(canonical).digest("hex");
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
