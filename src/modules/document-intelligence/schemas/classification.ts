import { z } from "zod";

export const CLASSIFICATION_TYPE_CODES = [
  "RG",
  "CPF",
  "CNH",
  "RG_CPF",
  "CERTIDAO_ESTADO_CIVIL",
  "COMPROVANTE_ENDERECO",
  "COMPROVANTE_RENDA",
  "CTPS",
  "CTPS_DIGITAL",
  "CONTRACHEQUE",
  "EXTRATO_BANCARIO",
  "FATURA_CARTAO",
  "SIMULACAO_CAIXA",
  "PESQUISA_IR",
  "DUMP",
  "EXTRATO_FGTS",
  "IMPOSTO_RENDA",
  "IRPF",
  "FATOR_SOCIAL",
  "OUTROS_DOCUMENTOS",
  "DOCUMENTO_VEICULO",
  "OUTRO",
] as const;

export const classificationResultSchema = z.object({
  documentType: z.string().min(2),
  confidence: z.number().min(0).max(1),
  provider: z.string(),
  model: z.string().optional(),
  promptVersion: z.string(),
});

export const extractedFieldSchema = z.object({
  field: z.string().min(1),
  value: z.string().nullable(),
  normalizedValue: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  page: z.number().int().positive().nullable().optional(),
  evidenceText: z.string().nullable().optional(),
  boundingBox: z
    .object({
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .nullable()
    .optional(),
});

export const extractionResultSchema = z.object({
  fields: z.array(extractedFieldSchema),
  extras: z.record(z.string(), z.unknown()).optional(),
  provider: z.string(),
  model: z.string().optional(),
  promptVersion: z.string(),
});

/** Map AI type labels to seeded document_types.code */
export function mapToKnownTypeCode(
  suggested: string,
  knownCodes: string[],
): string | null {
  const normalized = suggested.toUpperCase().replace(/\s+/g, "_");
  const aliases: Record<string, string> = {
    BANK_STATEMENT: "EXTRATO_BANCARIO",
    EXTRATO: "EXTRATO_BANCARIO",
    PAYROLL: "CONTRACHEQUE",
    HOLERITE: "CONTRACHEQUE",
    CREDIT_CARD: "FATURA_CARTAO",
    FATURA: "FATURA_CARTAO",
    CTPS: "CTPS_DIGITAL",
    CARTEIRA_TRABALHO: "CTPS_DIGITAL",
    ADDRESS: "COMPROVANTE_ENDERECO",
    ADDRESS_PROOF: "COMPROVANTE_ENDERECO",
    CIVIL_STATUS: "CERTIDAO_ESTADO_CIVIL",
    RG: "RG_CPF",
    CPF: "RG_CPF",
    CNH: "RG_CPF",
    PASSAPORTE: "RG_CPF",
    IDENTIDADE: "RG_CPF",
    IRPF: "IMPOSTO_RENDA",
    DECLARACAO_IR: "IMPOSTO_RENDA",
    FGTS: "EXTRATO_FGTS",
    SIMULACAO: "SIMULACAO_CAIXA",
    RENDA: "COMPROVANTE_RENDA",
    OUTRO: "OUTROS_DOCUMENTOS",
    OUTROS: "OUTROS_DOCUMENTOS",
  };
  const candidate = aliases[normalized] ?? normalized;
  if (knownCodes.includes(candidate)) return candidate;
  if (knownCodes.includes(normalized)) return normalized;
  return null;
}
