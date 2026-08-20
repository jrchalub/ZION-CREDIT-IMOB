export const PROMPT_VERSIONS = {
  classification: "document-classification-v1",
  rgExtraction: "rg-extraction-v1",
  cpfExtraction: "cpf-extraction-v1",
  addressExtraction: "address-extraction-v1",
  civilStatusExtraction: "civil-status-extraction-v1",
  ctpsExtraction: "ctps-extraction-v1",
  bankStatementExtraction: "bank-statement-extraction-v1",
  creditCardExtraction: "credit-card-extraction-v1",
  payrollExtraction: "payroll-extraction-v1",
  consistency: "document-consistency-v1",
} as const;

export type PromptVersion =
  (typeof PROMPT_VERSIONS)[keyof typeof PROMPT_VERSIONS];
