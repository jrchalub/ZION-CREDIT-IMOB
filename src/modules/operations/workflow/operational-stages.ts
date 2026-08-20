import type { ProcessStatus } from "@/domain/process/status-machine";

/**
 * Operational stages for daily ops UX (FASE 6).
 * Mapped from existing process_status — no credit decision semantics.
 * APROVADO / REPROVADO here = institutional/operational outcome, never AI.
 */
export const OPERATIONAL_STAGES = [
  "NOVO",
  "CADASTRO_INCOMPLETO",
  "AGUARDANDO_DOCUMENTOS",
  "DOCUMENTACAO_EM_ANALISE",
  "PENDENCIA",
  "ANALISE_FINANCEIRA",
  "DOSSIE_PRONTO",
  "EM_ANALISE",
  "PARECER",
  "ENVIADO_PARA_INSTITUICAO",
  "EM_AVALIACAO",
  "APROVADO",
  "CONTRATACAO",
  "REPROVADO",
  "CANCELADO",
] as const;

export type OperationalStage = (typeof OPERATIONAL_STAGES)[number];

export const OPERATIONAL_STAGE_LABELS: Record<OperationalStage, string> = {
  NOVO: "Novo",
  CADASTRO_INCOMPLETO: "Cadastro incompleto",
  AGUARDANDO_DOCUMENTOS: "Aguardando documentos",
  DOCUMENTACAO_EM_ANALISE: "Documentação em análise",
  PENDENCIA: "Pendência",
  ANALISE_FINANCEIRA: "Análise financeira",
  DOSSIE_PRONTO: "Dossiê pronto",
  EM_ANALISE: "Em análise (analista)",
  PARECER: "Parecer",
  ENVIADO_PARA_INSTITUICAO: "Enviado para instituição",
  EM_AVALIACAO: "Em avaliação (IF)",
  APROVADO: "Aprovado (instituição)",
  CONTRATACAO: "Contratação",
  REPROVADO: "Reprovado (instituição)",
  CANCELADO: "Cancelado",
};

/** Maps frozen process_status → operational stage for dashboards/portals */
export function toOperationalStage(status: ProcessStatus): OperationalStage {
  switch (status) {
    case "NOVO":
      return "NOVO";
    case "DOCUMENTACAO_PENDENTE":
      return "AGUARDANDO_DOCUMENTOS";
    case "AGUARDANDO_CLIENTE":
      return "PENDENCIA";
    case "DOCUMENTACAO_RECEBIDA":
    case "EM_TRIAGEM":
      return "DOCUMENTACAO_EM_ANALISE";
    case "PENDENCIA_ANALISTA":
      return "PENDENCIA";
    case "EM_ANALISE":
      return "ANALISE_FINANCEIRA";
    case "PRE_ANALISADO":
      return "DOSSIE_PRONTO";
    case "APTO":
      return "PARECER";
    case "NAO_APTO":
      return "PARECER";
    case "ENVIADO_AO_BANCO":
      return "ENVIADO_PARA_INSTITUICAO";
    case "AGUARDANDO_BANCO":
      return "EM_AVALIACAO";
    case "APROVADO":
      return "APROVADO";
    case "CONTRATADO":
      return "CONTRATACAO";
    case "REPROVADO":
      return "REPROVADO";
    case "CANCELADO":
      return "CANCELADO";
    default:
      return "NOVO";
  }
}

export type NotificationEventType =
  | "DOCUMENT_REQUIRED"
  | "DOCUMENT_REJECTED"
  | "PENDENCY_CREATED"
  | "PENDENCY_RESOLVED"
  | "ANALYSIS_STARTED"
  | "ANALYSIS_COMPLETED"
  | "DOSSIER_READY"
  | "ANALYST_REVIEW"
  | "DECISION_UPDATED"
  | "STATUS_CHANGED";

export function eventForStatusTransition(
  to: ProcessStatus,
): NotificationEventType {
  switch (to) {
    case "DOCUMENTACAO_PENDENTE":
    case "AGUARDANDO_CLIENTE":
      return "DOCUMENT_REQUIRED";
    case "EM_ANALISE":
    case "EM_TRIAGEM":
      return "ANALYSIS_STARTED";
    case "PRE_ANALISADO":
    case "APTO":
      return "DOSSIER_READY";
    case "PENDENCIA_ANALISTA":
      return "PENDENCY_CREATED";
    case "APROVADO":
    case "REPROVADO":
    case "CONTRATADO":
      return "DECISION_UPDATED";
    default:
      return "STATUS_CHANGED";
  }
}
