export const CREDIT_SUPPORT_RULES_VERSION = "credit-support-v1";
export const CREDIT_SUPPORT_VERSION = "credit-support-v1";

export const CREDIT_SUPPORT_DISCLAIMER =
  "Resultado de suporte à decisão interna. Não representa aprovação ou reprovação de crédito por instituição financeira. A decisão final é sempre do analista humano.";

export type FactorKind = "POSITIVO" | "ATENCAO" | "PENDENCIA";
export type FactorSeverity = "INFO" | "OK" | "ATENCAO" | "CRITICO";
export type MatrixResult = "OK" | "ATENCAO" | "CRITICO" | "NA";
export type DecisionIndicative =
  | "FAVORAVEL"
  | "REQUER_ANALISE"
  | "DESFAVORAVEL";

export type ExplainableFactor = {
  kind: FactorKind;
  code: string;
  description: string;
  severity: FactorSeverity;
  category: string;
  originType: string;
  originId: string | null;
  originLabel: string | null;
  evidence: {
    documentId?: string;
    page?: number;
    evidenceText?: string;
    financialSnapshotId?: string;
    field?: string;
    path?: string[];
  };
};

export type MatrixRow = {
  category: string;
  result: MatrixResult;
  label: string;
};
