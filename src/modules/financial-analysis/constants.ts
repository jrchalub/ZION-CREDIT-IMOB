export const FINANCIAL_DISCLAIMER =
  "Resultado de pré-análise interna. Não representa aprovação ou reprovação de crédito por instituição financeira.";

export const INCOME_METHOD_VERSION = "income-v1";
export const CLASSIFIER_RULES_VERSION = "rules-v1";

export type TransactionCategory =
  | "INCOME_PROBABLE"
  | "SALARY"
  | "OWN_TRANSFER"
  | "LOAN"
  | "REFUND"
  | "CARD_PAYMENT"
  | "EXPENSE"
  | "FEE"
  | "UNKNOWN";

/** Categories excluded from "valid credits" for income estimation */
export const INCOME_EXCLUSION_CATEGORIES: ReadonlySet<TransactionCategory> = new Set([
  "OWN_TRANSFER",
  "LOAN",
  "REFUND",
]);

export type FinancialIndicative =
  | "FAVORAVEL"
  | "NECESSITA_ANALISE"
  | "DESFAVORAVEL";
