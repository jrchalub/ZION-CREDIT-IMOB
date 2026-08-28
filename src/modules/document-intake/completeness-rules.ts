import { monthCoverage, monthLabelPt, type MonthCoverage } from "./periods";

export type CompletenessItem = {
  code: string;
  label: string;
  category: string;
  ok: boolean;
  warning?: string | null;
  required: boolean;
};

export type DocumentationStatus =
  | "INCOMPLETA"
  | "AGUARDANDO_REVISAO"
  | "APROVADA_PARA_ANALISE";

export function deriveDocumentationStatus(input: {
  requiredOk: boolean;
  unidentifiedCount: number;
  expiredCount: number;
  missingPeriodCount: number;
}): DocumentationStatus {
  if (input.unidentifiedCount > 0) return "AGUARDANDO_REVISAO";
  if (!input.requiredOk || input.expiredCount > 0 || input.missingPeriodCount > 0) {
    return "INCOMPLETA";
  }
  return "APROVADA_PARA_ANALISE";
}

export function statementPeriodSummary(input: {
  requiredMonths: string[];
  presentMonths: string[];
  typeLabel?: string;
}) {
  const coverage = monthCoverage(input.requiredMonths, input.presentMonths);
  const title = input.typeLabel ?? "EXTRATOS BANCÁRIOS";
  if (coverage.complete) {
    return {
      ...coverage,
      headline: `${title} — COMPLETO`,
      pendency: null as string | null,
    };
  }
  const missingLabels = coverage.missing.map(monthLabelPt).join(", ");
  return {
    ...coverage,
    headline: `PENDÊNCIA — Falta ${title.toLowerCase()} de ${missingLabels}.`,
    pendency: `Falta ${title.toLowerCase()} de ${missingLabels}.`,
  };
}

export function visualSummaryLines(items: CompletenessItem[]): string[] {
  return items.map((item) => {
    if (item.warning) return `⚠ ${item.label} — ${item.warning}`;
    return item.ok ? `✓ ${item.label}` : `⚠ ${item.label} — pendente`;
  });
}

export type { MonthCoverage };
