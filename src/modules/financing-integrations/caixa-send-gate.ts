export type InstitutionalChannel = "NENHUM" | "CAIXA" | "OUTRO";

export type CaixaSdkGateInput = {
  envEnabled: boolean;
  tenantEnabled: boolean;
  processOptIn: boolean;
  channel: InstitutionalChannel | string | null | undefined;
  /** Em produção, Caixa exige SDK ligado no ambiente (não usa mock silencioso). */
  productionStrict?: boolean;
};

export type InstitutionalSendDecision =
  | { ok: true; mode: "caixa" | "outro" }
  | { ok: false; code: string; message: string };

export function parseInstitutionalChannel(
  value: string | null | undefined,
): InstitutionalChannel {
  if (value === "CAIXA" || value === "OUTRO" || value === "NENHUM") {
    return value;
  }
  return "NENHUM";
}

export function envCaixaSdkEnabled(
  env: Record<string, string | undefined>,
): boolean {
  const provider = (env.FINANCING_PROVIDER ?? "").toLowerCase();
  return env.CAIXA_SDK_ENABLED === "true" || provider === "caixa-sdk";
}

export function envCaixaCredentialsConfigured(
  env: Record<string, string | undefined>,
): boolean {
  if (!env.CAIXA_API_URL?.trim()) return false;
  if (env.CAIXA_API_TOKEN?.trim()) return true;
  return Boolean(env.CAIXA_CLIENT_ID?.trim() && env.CAIXA_CLIENT_SECRET?.trim());
}

export function tenantCaixaSdkEnabled(
  settings: Record<string, unknown> | null | undefined,
): boolean {
  return settings?.caixaSdkEnabled === true;
}

/**
 * Envio institucional é sempre opt-in do cliente.
 * Caixa SDK só se escritório + env também estiverem ligados.
 */
export function evaluateInstitutionalSend(
  input: CaixaSdkGateInput,
): InstitutionalSendDecision {
  const channel = parseInstitutionalChannel(input.channel);

  if (!input.processOptIn) {
    return {
      ok: false,
      code: "CLIENT_OPT_IN_REQUIRED",
      message:
        "O cliente não autorizou envio a banco. O dossiê permanece interno.",
    };
  }

  if (channel === "NENHUM") {
    return {
      ok: false,
      code: "INSTITUTIONAL_CHANNEL_NONE",
      message:
        "Cliente optou por não enviar a nenhuma instituição. Escolha Caixa ou outro banco.",
    };
  }

  if (channel === "OUTRO") {
    return { ok: true, mode: "outro" };
  }

  if (!input.tenantEnabled) {
    return {
      ok: false,
      code: "TENANT_CAIXA_SDK_DISABLED",
      message:
        "O escritório não habilitou o envio via SDK Caixa. Use outro banco ou ative em Configurações.",
    };
  }

  if (input.productionStrict && !input.envEnabled) {
    return {
      ok: false,
      code: "CAIXA_SDK_ENV_DISABLED",
      message:
        "SDK Caixa desligado neste ambiente (CAIXA_SDK_ENABLED). O envio à Caixa não será disparado.",
    };
  }

  return { ok: true, mode: "caixa" };
}
