import { buildPortalDeepLink } from "../portal/deep-link";

export function buildStatusChangeMessage(input: {
  clientName: string;
  processNumber: string;
  toStatusLabel: string;
  operationalStageLabel: string;
  portalUrl?: string | null;
}) {
  const lines = [
    `Olá, ${input.clientName}.`,
    "",
    `Seu processo ${input.processNumber} foi atualizado.`,
    `Status: ${input.toStatusLabel}`,
    `Etapa operacional: ${input.operationalStageLabel}`,
  ];
  if (input.portalUrl) {
    lines.push("", "Acompanhe e envie documentos pelo link seguro:", input.portalUrl);
  }
  lines.push(
    "",
    "Esta é uma mensagem automática do Zion Credit (pré-análise interna).",
  );
  return {
    subject: `Atualização do processo ${input.processNumber}`,
    body: lines.join("\n"),
  };
}

/**
 * WhatsApp-oriented copy: notification + deep link only (no document payload).
 */
export function buildPendencyPortalMessage(input: {
  clientName: string;
  processNumber: string;
  title: string;
  description: string;
  rawPortalToken: string;
}) {
  const portalUrl = buildPortalDeepLink(input.rawPortalToken);
  const first = input.clientName.trim().split(/\s+/)[0] ?? input.clientName;
  return {
    subject: `Pendência no processo ${input.processNumber}`,
    body: [
      `Olá, ${first}.`,
      "",
      "Existe uma pendência no seu financiamento.",
      `Processo: ${input.processNumber}`,
      `Pendência: ${input.title}`,
      input.description,
      "",
      "Acesse o processo pelo link seguro:",
      portalUrl,
      "",
      "Não compartilhe este link. Ele é pessoal e temporário.",
    ].join("\n"),
    portalUrl,
    portalPath: `/portal/${input.rawPortalToken}`,
  };
}
