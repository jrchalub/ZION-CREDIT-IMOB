import type {
  FinancingInstitution,
  FinancingProvider,
  FinancingProviderResult,
  FinancingSubmitInput,
  FinancingTrackInput,
} from "./FinancingProvider";
import { envCaixaCredentialsConfigured } from "./caixa-send-gate";

function baseUrl() {
  return (process.env.CAIXA_API_URL ?? "").replace(/\/$/, "");
}

function submitPath() {
  return process.env.CAIXA_SUBMIT_PATH || "/v1/propostas";
}

function trackPath(ref: string) {
  const template = process.env.CAIXA_TRACK_PATH || "/v1/propostas/{ref}";
  return template.replace("{ref}", encodeURIComponent(ref));
}

async function caixaAuthHeader(): Promise<string | null> {
  const staticToken = process.env.CAIXA_API_TOKEN?.trim();
  if (staticToken) return `Bearer ${staticToken}`;

  const tokenUrl = process.env.CAIXA_TOKEN_URL?.trim();
  const clientId = process.env.CAIXA_CLIENT_ID?.trim();
  const clientSecret = process.env.CAIXA_CLIENT_SECRET?.trim();
  if (!tokenUrl || !clientId || !clientSecret) return null;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: process.env.CAIXA_OAUTH_SCOPE ?? "",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`CAIXA_OAUTH_${res.status}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("CAIXA_OAUTH_NO_TOKEN");
  return `Bearer ${json.access_token}`;
}

/**
 * Adapter HTTP do canal Caixa Habitação (sem pacote npm oficial).
 * Não envia CPF completo nem binários — só o payload já redigido do domínio.
 */
export class CaixaSdkFinancingProvider implements FinancingProvider {
  readonly name = "caixa-sdk";
  readonly institution: FinancingInstitution = "CAIXA";

  async submit(input: FinancingSubmitInput): Promise<FinancingProviderResult> {
    if (!envCaixaCredentialsConfigured(process.env)) {
      return {
        ok: false,
        errorMessage:
          "CAIXA_API_URL e token/credenciais OAuth são obrigatórios com SDK ligado",
        summary: { source: "caixa-sdk", missingCredentials: true },
      };
    }

    try {
      const auth = await caixaAuthHeader();
      if (!auth) {
        return {
          ok: false,
          errorMessage: "Falha ao autenticar no canal Caixa",
          summary: { source: "caixa-sdk", auth: false },
        };
      }

      const res = await fetch(`${baseUrl()}${submitPath()}`, {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "submit",
          institution: "CAIXA",
          processId: input.processId,
          tenantId: input.tenantId,
          proposal: input.proposal,
          metadata: input.metadata,
        }),
      });

      if (!res.ok) {
        return {
          ok: false,
          errorMessage: `CAIXA_SDK_HTTP_${res.status}`,
          summary: { source: "caixa-sdk", httpStatus: res.status },
        };
      }

      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        ref?: string;
        protocol?: string;
        externalStatus?: string;
        status?: string;
        summary?: Record<string, unknown>;
      };

      return {
        ok: true,
        providerRef:
          json.ref ?? json.protocol ?? json.id ?? `caixa-${Date.now()}`,
        externalStatus: json.externalStatus ?? json.status ?? "RECEBIDO",
        summary: {
          source: "caixa-sdk",
          institution: "CAIXA",
          disclaimer:
            "Retorno indicativo. APROVADO/REPROVADO só com confirmação humana.",
          ...(json.summary ?? {}),
        },
      };
    } catch (error) {
      return {
        ok: false,
        errorMessage:
          error instanceof Error ? error.message : "CAIXA_SDK_FAILED",
        summary: { source: "caixa-sdk", failed: true },
      };
    }
  }

  async track(input: FinancingTrackInput): Promise<FinancingProviderResult> {
    if (!envCaixaCredentialsConfigured(process.env)) {
      return {
        ok: false,
        errorMessage: "Credenciais Caixa ausentes para acompanhamento",
        summary: { source: "caixa-sdk", missingCredentials: true },
      };
    }

    try {
      const auth = await caixaAuthHeader();
      if (!auth) {
        return {
          ok: false,
          errorMessage: "Falha ao autenticar no canal Caixa",
          summary: { source: "caixa-sdk", auth: false },
        };
      }

      const res = await fetch(`${baseUrl()}${trackPath(input.providerRef)}`, {
        method: "GET",
        headers: { Authorization: auth },
      });

      if (!res.ok) {
        return {
          ok: false,
          errorMessage: `CAIXA_SDK_TRACK_${res.status}`,
          summary: { source: "caixa-sdk", httpStatus: res.status },
        };
      }

      const json = (await res.json().catch(() => ({}))) as {
        externalStatus?: string;
        status?: string;
        summary?: Record<string, unknown>;
      };

      return {
        ok: true,
        providerRef: input.providerRef,
        externalStatus: json.externalStatus ?? json.status ?? undefined,
        summary: {
          source: "caixa-sdk",
          action: "track",
          disclaimer: "Sem transição automática de APROVADO/REPROVADO.",
          ...(json.summary ?? {}),
        },
      };
    } catch (error) {
      return {
        ok: false,
        errorMessage:
          error instanceof Error ? error.message : "CAIXA_SDK_TRACK_FAILED",
        summary: { source: "caixa-sdk", failed: true },
      };
    }
  }
}

/** Encaminhamento a outro banco — não chama Caixa. */
export class ManualOtherBankProvider implements FinancingProvider {
  readonly name = "manual-other-bank";
  readonly institution: FinancingInstitution = "OUTRO";

  async submit(input: FinancingSubmitInput): Promise<FinancingProviderResult> {
    return {
      ok: true,
      skipped: true,
      providerRef: `manual-${input.processId.slice(0, 8)}-${Date.now()}`,
      externalStatus: "ENCAMINHAMENTO_MANUAL",
      summary: {
        source: "manual",
        institution: "OUTRO",
        intendedBank: input.proposal.intendedBank ?? null,
        notes:
          "Cliente escolheu outro banco. Nenhum envio ao SDK Caixa foi feito.",
      },
    };
  }

  async track(input: FinancingTrackInput): Promise<FinancingProviderResult> {
    return {
      ok: true,
      skipped: true,
      providerRef: input.providerRef,
      externalStatus: "ENCAMINHAMENTO_MANUAL",
      summary: {
        source: "manual",
        action: "track",
        notes: "Acompanhamento manual — sem canal Caixa.",
      },
    };
  }
}
