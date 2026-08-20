export const INCOME_PROFILES = [
  "AUTONOMO",
  "CLT",
  "MEI",
  "EMPRESARIO",
  "SERVIDOR_PUBLICO",
  "APOSENTADO",
  "PENSIONISTA",
  "COMPOSICAO_RENDA",
  "SOCIO_EMPRESA",
  "PRODUTOR_RURAL",
] as const;

export type IncomeProfile = (typeof INCOME_PROFILES)[number];

export type ChecklistRequirement = "OBRIGATORIO" | "CONDICIONAL" | "OPCIONAL";

export type CaixaAnnex = {
  annexNumber: number;
  code: string;
  title: string;
  description: string;
  category: string;
  requirement: ChecklistRequirement;
  allowsMultiple?: boolean;
  conditionKey?: string;
  validityDays?: number;
};

/** Tipos usados pela análise financeira / IA, fora do checklist de anexos Caixa. */
export const ANALYSIS_DOCUMENT_TYPES = [
  {
    code: "EXTRATO_BANCARIO",
    name: "Extrato bancário",
    category: "FINANCEIRO",
    description: "Extrato bancário para análise de renda e movimentação.",
    allowsMultiple: true,
    requiresCompetence: true,
  },
  {
    code: "FATURA_CARTAO",
    name: "Fatura de cartão",
    category: "FINANCEIRO",
    description: "Fatura de cartão de crédito para análise de comprometimento.",
    allowsMultiple: true,
    requiresCompetence: true,
  },
  {
    code: "CONTRACHEQUE",
    name: "Contracheque",
    category: "RENDA",
    description: "Holerite/contracheque para comprovação de renda CLT.",
    allowsMultiple: true,
    requiresCompetence: true,
  },
] as const;

/**
 * Anexos oficiais de documentação para financiamento habitacional Caixa.
 * Codes estáveis: RG_CPF, CERTIDAO_ESTADO_CIVIL, COMPROVANTE_ENDERECO e
 * CTPS_DIGITAL são reaproveitados para não quebrar documentos já enviados.
 */
export const CAIXA_ANNEXES: readonly CaixaAnnex[] = [
  {
    annexNumber: 1,
    code: "SIMULACAO_CAIXA",
    title: "Simulação de Financiamento Caixa",
    description:
      "Simulação de financiamento habitacional realizada pela Caixa Econômica Federal. Deve conter informações como prazo do financiamento, valor aprovado, valor de entrada, valor das parcelas, situação da proposta e demais informações relacionadas à aprovação e às condições do financiamento.",
    category: "FINANCIAMENTO",
    requirement: "OBRIGATORIO",
  },
  {
    annexNumber: 2,
    code: "RG_CPF",
    title: "Documentação de Identificação",
    description:
      "Documentos utilizados para identificação do cliente, como CPF, RG, CNH, passaporte ou outro documento oficial de identificação aceito pela instituição financeira.",
    category: "IDENTIDADE",
    requirement: "OBRIGATORIO",
    allowsMultiple: true,
  },
  {
    annexNumber: 3,
    code: "CERTIDAO_ESTADO_CIVIL",
    title: "Certidão de Estado Civil",
    description:
      "Documento que comprova o estado civil do cliente. Pode incluir certidão de nascimento, certidão de casamento, certidão com averbação de divórcio, certidão de óbito do cônjuge ou outros documentos necessários para comprovação da situação civil.",
    category: "IDENTIDADE",
    requirement: "OBRIGATORIO",
    allowsMultiple: true,
  },
  {
    annexNumber: 4,
    code: "COMPROVANTE_RENDA",
    title: "Comprovante de Renda",
    description:
      "Documentação utilizada para comprovar a renda considerada no financiamento. Pode incluir contracheque, holerite, extratos bancários, pró-labore, declaração de renda e demais documentos aceitos pela Caixa para comprovação da capacidade financeira do cliente.",
    category: "RENDA",
    requirement: "OBRIGATORIO",
    allowsMultiple: true,
  },
  {
    annexNumber: 5,
    code: "COMPROVANTE_ENDERECO",
    title: "Comprovante de Endereço",
    description:
      "Documento utilizado para comprovar o endereço residencial do cliente. Deve estar dentro do prazo de validade de 60 dias, considerando a data exigida para o processo de financiamento.",
    category: "RESIDENCIA",
    requirement: "OBRIGATORIO",
    validityDays: 60,
  },
  {
    annexNumber: 6,
    code: "PESQUISA_IR",
    title: "Pesquisa IR — Imposto de Renda",
    description:
      "Documento ou consulta relacionada à situação do cliente perante o Imposto de Renda, utilizada para conferência das informações fiscais e análise documental do financiamento.",
    category: "FISCAL",
    requirement: "OBRIGATORIO",
  },
  {
    annexNumber: 7,
    code: "DUMP",
    title: "DUMP",
    description:
      "DUMP da proposta/consulta cadastral da Caixa Econômica Federal, utilizado na análise de crédito e conferência das informações do financiamento habitacional.",
    category: "CREDITO",
    requirement: "OBRIGATORIO",
  },
  {
    annexNumber: 8,
    code: "EXTRATO_FGTS",
    title: "Extrato do FGTS",
    description:
      "Extrato atualizado da conta vinculada do FGTS do cliente, utilizado para verificar saldo disponível e eventual utilização dos recursos no financiamento habitacional.",
    category: "TRABALHO",
    requirement: "OBRIGATORIO",
  },
  {
    annexNumber: 9,
    code: "CTPS_DIGITAL",
    title: "Carteira de Trabalho",
    description:
      "Documentação referente à Carteira de Trabalho do cliente. Sempre verificar se o cliente possui a Carteira de Trabalho física e solicitar também a Carteira de Trabalho Digital, mesmo quando a documentação física estiver disponível.",
    category: "TRABALHO",
    requirement: "OBRIGATORIO",
    allowsMultiple: true,
  },
  {
    annexNumber: 10,
    code: "IMPOSTO_RENDA",
    title: "Imposto de Renda",
    description:
      "Declaração de Imposto de Renda do cliente, devendo conter o recibo de entrega e a declaração completa, quando aplicável ao cliente.",
    category: "FISCAL",
    requirement: "OBRIGATORIO",
    allowsMultiple: true,
  },
  {
    annexNumber: 11,
    code: "FATOR_SOCIAL",
    title: "Fator Social",
    description:
      "Documentação utilizada para análise do fator social e enquadramento dos dependentes relacionados ao financiamento no âmbito do Minha Casa Minha Vida. Deve contemplar a documentação necessária dos dependentes considerados no financiamento.",
    category: "SOCIAL",
    requirement: "CONDICIONAL",
    conditionKey: "FATOR_SOCIAL",
    allowsMultiple: true,
  },
  {
    annexNumber: 12,
    code: "OUTROS_DOCUMENTOS",
    title: "Outros Documentos",
    description:
      "Documentos adicionais que possam auxiliar na análise, comprovação de renda, composição de renda, capacidade financeira, enquadramento ou aprovação do financiamento. Devem ser incluídos sempre que contribuírem para a análise do cliente ou forem solicitados pela instituição financeira.",
    category: "GERAL",
    requirement: "OPCIONAL",
    allowsMultiple: true,
  },
];

export function annexLabel(annex: CaixaAnnex) {
  return `Anexo ${annex.annexNumber} — ${annex.title}`;
}

export function getAnnexByCode(code: string) {
  return CAIXA_ANNEXES.find((annex) => annex.code === code) ?? null;
}
