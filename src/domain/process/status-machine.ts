export const PROCESS_STATUSES = [
  "NOVO",
  "DOCUMENTACAO_PENDENTE",
  "DOCUMENTACAO_RECEBIDA",
  "EM_TRIAGEM",
  "EM_ANALISE",
  "PENDENCIA_ANALISTA",
  "PRE_ANALISADO",
  "APTO",
  "NAO_APTO",
  "AGUARDANDO_CLIENTE",
  "AGUARDANDO_BANCO",
  "ENVIADO_AO_BANCO",
  "APROVADO",
  "REPROVADO",
  "CONTRATADO",
  "CANCELADO",
] as const;

export type ProcessStatus = (typeof PROCESS_STATUSES)[number];

/**
 * Allowed transitions for the financing process state machine.
 * Terminal-ish states (CONTRATADO, CANCELADO) have limited outgoing edges.
 */
const TRANSITIONS: Record<ProcessStatus, readonly ProcessStatus[]> = {
  NOVO: ["DOCUMENTACAO_PENDENTE", "DOCUMENTACAO_RECEBIDA", "CANCELADO"],
  DOCUMENTACAO_PENDENTE: [
    "DOCUMENTACAO_RECEBIDA",
    "AGUARDANDO_CLIENTE",
    "CANCELADO",
  ],
  DOCUMENTACAO_RECEBIDA: ["EM_TRIAGEM", "DOCUMENTACAO_PENDENTE", "CANCELADO"],
  EM_TRIAGEM: [
    "EM_ANALISE",
    "DOCUMENTACAO_PENDENTE",
    "PENDENCIA_ANALISTA",
    "CANCELADO",
  ],
  EM_ANALISE: [
    "PENDENCIA_ANALISTA",
    "PRE_ANALISADO",
    "AGUARDANDO_CLIENTE",
    "CANCELADO",
  ],
  PENDENCIA_ANALISTA: ["EM_ANALISE", "AGUARDANDO_CLIENTE", "CANCELADO"],
  PRE_ANALISADO: ["APTO", "NAO_APTO", "EM_ANALISE", "CANCELADO"],
  APTO: ["AGUARDANDO_BANCO", "ENVIADO_AO_BANCO", "CANCELADO"],
  NAO_APTO: ["EM_ANALISE", "CANCELADO"],
  AGUARDANDO_CLIENTE: [
    "DOCUMENTACAO_RECEBIDA",
    "EM_ANALISE",
    "CANCELADO",
  ],
  AGUARDANDO_BANCO: ["ENVIADO_AO_BANCO", "CANCELADO"],
  ENVIADO_AO_BANCO: ["APROVADO", "REPROVADO", "AGUARDANDO_BANCO", "CANCELADO"],
  APROVADO: ["CONTRATADO", "CANCELADO"],
  REPROVADO: ["EM_ANALISE", "CANCELADO"],
  CONTRATADO: [],
  CANCELADO: [],
};

export function canTransition(
  from: ProcessStatus,
  to: ProcessStatus,
): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ProcessStatus, to: ProcessStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Transição inválida de status: ${from} → ${to}`);
  }
}

export function getAllowedTransitions(from: ProcessStatus): ProcessStatus[] {
  return [...TRANSITIONS[from]];
}

export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
  NOVO: "Novo",
  DOCUMENTACAO_PENDENTE: "Documentação pendente",
  DOCUMENTACAO_RECEBIDA: "Documentação recebida",
  EM_TRIAGEM: "Em triagem",
  EM_ANALISE: "Em análise",
  PENDENCIA_ANALISTA: "Pendência do analista",
  PRE_ANALISADO: "Pré-analisado",
  APTO: "Apto (pré-análise)",
  NAO_APTO: "Não apto (pré-análise)",
  AGUARDANDO_CLIENTE: "Aguardando cliente",
  AGUARDANDO_BANCO: "Aguardando banco",
  ENVIADO_AO_BANCO: "Enviado ao banco",
  APROVADO: "Aprovado pela instituição",
  REPROVADO: "Reprovado pela instituição",
  CONTRATADO: "Contratado",
  CANCELADO: "Cancelado",
};
