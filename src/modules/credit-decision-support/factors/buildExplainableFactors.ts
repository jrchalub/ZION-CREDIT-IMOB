import type {
  DecisionIndicative,
  ExplainableFactor,
  MatrixResult,
  MatrixRow,
} from "../constants";

export type FactorBuildInput = {
  financialSnapshotId: string | null;
  financialPayload: Record<string, unknown> | null;
  documentationPct: number;
  consistencyScore: number | null;
  consistencyFactors: Array<{ label: string; positive: boolean }>;
  consistencyIssues: Array<{ type: string; message: string }>;
  openPendencies: Array<{
    id: string;
    type: string;
    description: string;
    documentId?: string | null;
  }>;
  declaredIncome: number | null;
  analyzedIncome: number | null;
};

/**
 * Pure, deterministic factor builder — no magic score.
 * Every factor carries provenance (origin + evidence path).
 */
export function buildExplainableFactors(
  input: FactorBuildInput,
): ExplainableFactor[] {
  const factors: ExplainableFactor[] = [];
  const finId = input.financialSnapshotId;
  const payload = input.financialPayload ?? {};
  const flags = (payload.flags as string[] | undefined) ?? [];
  const statements =
    (payload.statements as Array<{ yearMonth: string; validCredits: number }>) ??
    [];
  const commitmentPct =
    typeof payload.commitmentPct === "number" ? payload.commitmentPct : null;
  const cards =
    (payload.commitments as { cards?: number } | undefined)?.cards ?? 0;
  const debts =
    (payload.commitments as { debts?: number } | undefined)?.debts ?? 0;

  // Documentation
  if (input.documentationPct >= 100) {
    factors.push({
      kind: "POSITIVO",
      code: "DOCUMENTATION_COMPLETE",
      description: "Checklist obrigatório 100% validado.",
      severity: "OK",
      category: "Documentação",
      originType: "checklist",
      originId: null,
      originLabel: "Checklist do processo",
      evidence: { path: ["checklist", "required", "VALIDADO"] },
    });
  } else {
    factors.push({
      kind: "ATENCAO",
      code: "DOCUMENTATION_INCOMPLETE",
      description: `Documentação obrigatória em ${input.documentationPct}%.`,
      severity: input.documentationPct < 70 ? "CRITICO" : "ATENCAO",
      category: "Documentação",
      originType: "checklist",
      originId: null,
      originLabel: "Checklist do processo",
      evidence: { path: ["checklist", "required"] },
    });
  }

  // Identity / consistency
  for (const f of input.consistencyFactors) {
    factors.push({
      kind: f.positive ? "POSITIVO" : "ATENCAO",
      code: f.positive ? "IDENTITY_CONSISTENT" : "IDENTITY_INCONSISTENT",
      description: f.label,
      severity: f.positive ? "OK" : "ATENCAO",
      category: "Identidade",
      originType: "consistency_check",
      originId: null,
      originLabel: "Consistência documental",
      evidence: {
        path: ["document_consistency_checks", "factors"],
        field: f.label,
      },
    });
  }

  for (const issue of input.consistencyIssues) {
    factors.push({
      kind: "ATENCAO",
      code: `CONSISTENCY_${issue.type}`,
      description: issue.message,
      severity: issue.type.includes("MISMATCH") ? "CRITICO" : "ATENCAO",
      category: "Consistência documental",
      originType: "consistency_check",
      originId: null,
      originLabel: issue.type,
      evidence: { path: ["document_consistency_checks", "issues"], field: issue.type },
    });
  }

  // Income
  if (statements.length >= 3) {
    factors.push({
      kind: "POSITIVO",
      code: "INCOME_CONSISTENCY",
      description:
        "Renda identificada apresenta recorrência nos três (ou mais) meses analisados.",
      severity: "OK",
      category: "Renda",
      originType: "financial_snapshot",
      originId: finId,
      originLabel: finId ? `Financial Snapshot ${finId.slice(0, 8)}` : "Financial Snapshot",
      evidence: {
        financialSnapshotId: finId ?? undefined,
        path: ["statements"],
        field: "validCredits",
      },
    });
  }

  if (flags.includes("FEW_STATEMENT_MONTHS") || statements.length === 1) {
    factors.push({
      kind: "ATENCAO",
      code: "INCOME_FEW_MONTHS",
      description: "Apenas um mês (ou poucos) de extrato disponível para renda.",
      severity: "ATENCAO",
      category: "Renda",
      originType: "financial_snapshot",
      originId: finId,
      originLabel: finId ? `Financial Snapshot ${finId.slice(0, 8)}` : null,
      evidence: {
        financialSnapshotId: finId ?? undefined,
        path: ["flags"],
        field: "FEW_STATEMENT_MONTHS",
      },
    });
  }

  if (flags.includes("LOW_INCOME_CONFIDENCE")) {
    factors.push({
      kind: "ATENCAO",
      code: "INCOME_LOW_CONFIDENCE",
      description: "Baixa confiança na renda bancária estimada.",
      severity: "ATENCAO",
      category: "Renda",
      originType: "financial_snapshot",
      originId: finId,
      originLabel: finId ? `Financial Snapshot ${finId.slice(0, 8)}` : null,
      evidence: {
        financialSnapshotId: finId ?? undefined,
        path: ["flags"],
        field: "LOW_INCOME_CONFIDENCE",
      },
    });
  }

  const declared = input.declaredIncome;
  const analyzed = input.analyzedIncome;
  if (
    declared !== null &&
    analyzed !== null &&
    declared > 0 &&
    Math.abs(declared - analyzed) / Math.max(declared, analyzed) > 0.25
  ) {
    factors.push({
      kind: "ATENCAO",
      code: "DECLARED_BANKING_INCOME_DIVERGENCE",
      description:
        "Renda declarada diverge da renda bancária analisada (diferença > 25%).",
      severity: "ATENCAO",
      category: "Renda",
      originType: "financial_snapshot",
      originId: finId,
      originLabel: finId ? `Financial Snapshot ${finId.slice(0, 8)}` : null,
      evidence: {
        financialSnapshotId: finId ?? undefined,
        path: ["declaredIncome", "analyzedIncome"],
        field: "divergence",
      },
    });
  }

  // Commitment
  if (commitmentPct !== null) {
    if (commitmentPct > 40) {
      factors.push({
        kind: "ATENCAO",
        code: "COMMITMENT_HIGH",
        description: `Comprometimento elevado (${commitmentPct}%).`,
        severity: "CRITICO",
        category: "Comprometimento",
        originType: "financial_snapshot",
        originId: finId,
        originLabel: finId ? `Financial Snapshot ${finId.slice(0, 8)}` : null,
        evidence: {
          financialSnapshotId: finId ?? undefined,
          path: ["commitmentPct"],
        },
      });
    } else if (commitmentPct > 30) {
      factors.push({
        kind: "ATENCAO",
        code: "COMMITMENT_ATTENTION",
        description: `Comprometimento em faixa de atenção (${commitmentPct}%).`,
        severity: "ATENCAO",
        category: "Comprometimento",
        originType: "financial_snapshot",
        originId: finId,
        originLabel: finId ? `Financial Snapshot ${finId.slice(0, 8)}` : null,
        evidence: {
          financialSnapshotId: finId ?? undefined,
          path: ["commitmentPct"],
        },
      });
    } else {
      factors.push({
        kind: "POSITIVO",
        code: "COMMITMENT_OK",
        description: `Comprometimento adequado (${commitmentPct}%).`,
        severity: "OK",
        category: "Comprometimento",
        originType: "financial_snapshot",
        originId: finId,
        originLabel: finId ? `Financial Snapshot ${finId.slice(0, 8)}` : null,
        evidence: {
          financialSnapshotId: finId ?? undefined,
          path: ["commitmentPct"],
        },
      });
    }
  }

  if (debts > 0) {
    factors.push({
      kind: "ATENCAO",
      code: "DEBTS_PRESENT",
      description: `Há dívidas cadastradas com parcela mensal consolidada.`,
      severity: "ATENCAO",
      category: "Dívidas",
      originType: "financial_snapshot",
      originId: finId,
      originLabel: finId ? `Financial Snapshot ${finId.slice(0, 8)}` : null,
      evidence: {
        financialSnapshotId: finId ?? undefined,
        path: ["commitments", "debts"],
      },
    });
  }

  if (analyzed && analyzed > 0 && cards / analyzed > 0.4) {
    factors.push({
      kind: "ATENCAO",
      code: "CARD_NEAR_LIMIT",
      description: "Cartão com comprometimento elevado em relação à renda.",
      severity: "ATENCAO",
      category: "Cartão",
      originType: "financial_snapshot",
      originId: finId,
      originLabel: finId ? `Financial Snapshot ${finId.slice(0, 8)}` : null,
      evidence: {
        financialSnapshotId: finId ?? undefined,
        path: ["commitments", "cards"],
      },
    });
  } else if (cards > 0) {
    factors.push({
      kind: "POSITIVO",
      code: "CARD_MANAGEABLE",
      description: "Comprometimento de cartão dentro de faixa observável.",
      severity: "OK",
      category: "Cartão",
      originType: "financial_snapshot",
      originId: finId,
      originLabel: finId ? `Financial Snapshot ${finId.slice(0, 8)}` : null,
      evidence: {
        financialSnapshotId: finId ?? undefined,
        path: ["commitments", "cards"],
      },
    });
  }

  // Pendencies
  for (const p of input.openPendencies) {
    factors.push({
      kind: "PENDENCIA",
      code: `PENDENCY_${p.type}`,
      description: p.description,
      severity: "ATENCAO",
      category: "Pendências",
      originType: "pendency",
      originId: p.id,
      originLabel: p.documentId
        ? `Document ${p.documentId.slice(0, 8)}`
        : `Pendency ${p.id.slice(0, 8)}`,
      evidence: {
        documentId: p.documentId ?? undefined,
        path: ["pendencies", p.id],
      },
    });
  }

  if (input.openPendencies.length === 0) {
    factors.push({
      kind: "POSITIVO",
      code: "NO_OPEN_PENDENCIES",
      description: "Sem pendências abertas no processo.",
      severity: "OK",
      category: "Pendências",
      originType: "pendency",
      originId: null,
      originLabel: "Pendências",
      evidence: { path: ["pendencies"] },
    });
  }

  if (!finId) {
    factors.push({
      kind: "ATENCAO",
      code: "NO_FINANCIAL_SNAPSHOT",
      description: "Ainda não há snapshot financeiro imutável para este processo.",
      severity: "CRITICO",
      category: "Capacidade",
      originType: "financial_snapshot",
      originId: null,
      originLabel: null,
      evidence: { path: ["financial_analysis_snapshots"] },
    });
  }

  return factors;
}

export function buildFactorMatrix(factors: ExplainableFactor[]): MatrixRow[] {
  const categories = [
    "Documentação",
    "Identidade",
    "Renda",
    "Endereço",
    "Dívidas",
    "Cartão",
    "Comprometimento",
    "Capacidade",
    "Consistência documental",
    "Pendências",
  ];

  return categories.map((category) => {
    const related = factors.filter((f) => f.category === category);
    if (related.length === 0) {
      return { category, result: "NA" as MatrixResult, label: "Sem dados" };
    }
    if (related.some((f) => f.severity === "CRITICO")) {
      return { category, result: "CRITICO", label: "Crítico" };
    }
    if (
      related.some(
        (f) => f.kind === "ATENCAO" || f.kind === "PENDENCIA" || f.severity === "ATENCAO",
      )
    ) {
      return { category, result: "ATENCAO", label: "Atenção / Revisar" };
    }
    return { category, result: "OK", label: "Completa / Consistente" };
  });
}

/**
 * Indicative from matrix — never a numeric credit score.
 */
export function deriveIndicative(
  matrix: MatrixRow[],
  factors: ExplainableFactor[],
): DecisionIndicative {
  const critical = matrix.filter((m) => m.result === "CRITICO").length;
  const attention = matrix.filter((m) => m.result === "ATENCAO").length;
  const hasCriticalFactor = factors.some((f) => f.severity === "CRITICO");

  if (critical > 0 || hasCriticalFactor) return "DESFAVORAVEL";
  if (attention > 0 || factors.some((f) => f.kind === "PENDENCIA")) {
    return "REQUER_ANALISE";
  }
  return "FAVORAVEL";
}
