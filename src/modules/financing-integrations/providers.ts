import type {
  FinancingInstitution,
  FinancingProvider,
  FinancingProviderResult,
  FinancingSubmitInput,
  FinancingTrackInput,
} from "./FinancingProvider";

/**
 * Local mock for Caixa — no real institutional channel.
 */
export class MockCaixaFinancingProvider implements FinancingProvider {
  readonly name = "mock-caixa";
  readonly institution = "CAIXA" as const;

  async submit(input: FinancingSubmitInput): Promise<FinancingProviderResult> {
    const providerRef = `mock-caixa-${Date.now()}`;
    return {
      ok: true,
      providerRef,
      externalStatus: "EM_ANALISE_INSTITUICAO",
      summary: {
        source: "mock",
        institution: "CAIXA",
        action: "submit",
        processId: input.processId,
        processNumber: input.proposal.processNumber ?? null,
        notes:
          "Mock local — não envia proposta real à Caixa. Zion Credit não aprova crédito.",
        disclaimer:
          "Resultado fictício para operação. Confirmação institucional exige ação humana.",
      },
    };
  }

  async track(input: FinancingTrackInput): Promise<FinancingProviderResult> {
    return {
      ok: true,
      providerRef: input.providerRef,
      externalStatus: "EM_ANALISE_INSTITUICAO",
      summary: {
        source: "mock",
        institution: "CAIXA",
        action: "track",
        providerRef: input.providerRef,
        notes: "Status institucional simulado — sem mudança automática de processo.",
        disclaimer:
          "Acompanhar retorno; APROVADO/REPROVADO só via transição humana no processo.",
      },
    };
  }
}

/**
 * Generic HTTP adapter — POST { action, institution, processId, proposal|providerRef }.
 * Without FINANCING_PROVIDER_URL → skipped (ok).
 */
export class HttpFinancingProvider implements FinancingProvider {
  readonly name = "http-financing";
  readonly institution: FinancingInstitution;

  constructor(institution: FinancingInstitution = "CAIXA") {
    this.institution = institution;
  }

  private async post(
    body: Record<string, unknown>,
  ): Promise<FinancingProviderResult> {
    const url = process.env.FINANCING_PROVIDER_URL;
    if (!url) {
      return {
        ok: true,
        skipped: true,
        providerRef: `${this.name}-stub-${Date.now()}`,
        errorMessage: "FINANCING_PROVIDER_URL not configured — stubbed",
        summary: {
          source: "http-stub",
          institution: this.institution,
          skipped: true,
        },
      };
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.FINANCING_PROVIDER_TOKEN
            ? {
                Authorization: `Bearer ${process.env.FINANCING_PROVIDER_TOKEN}`,
              }
            : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        return {
          ok: false,
          errorMessage: `${this.name}_HTTP_${res.status}`,
          summary: {
            source: "http",
            institution: this.institution,
            httpStatus: res.status,
          },
        };
      }

      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        ref?: string;
        externalStatus?: string;
        status?: string;
        summary?: Record<string, unknown>;
      };

      return {
        ok: true,
        providerRef: json.ref ?? json.id ?? `${this.name}-${Date.now()}`,
        externalStatus: json.externalStatus ?? json.status ?? undefined,
        summary: {
          source: "http",
          institution: this.institution,
          ...(json.summary ?? { rawKeys: Object.keys(json).slice(0, 20) }),
        },
      };
    } catch (error) {
      return {
        ok: false,
        errorMessage:
          error instanceof Error ? error.message : `${this.name}_FAILED`,
        summary: {
          source: "http",
          institution: this.institution,
          failed: true,
        },
      };
    }
  }

  async submit(input: FinancingSubmitInput): Promise<FinancingProviderResult> {
    return this.post({
      action: "submit",
      institution: input.institution,
      tenantId: input.tenantId,
      processId: input.processId,
      proposal: input.proposal,
      metadata: input.metadata,
    });
  }

  async track(input: FinancingTrackInput): Promise<FinancingProviderResult> {
    return this.post({
      action: "track",
      institution: input.institution,
      tenantId: input.tenantId,
      processId: input.processId,
      providerRef: input.providerRef,
      metadata: input.metadata,
    });
  }
}

export function getFinancingProvider(
  institution: FinancingInstitution = "CAIXA",
): FinancingProvider {
  const mode = (process.env.FINANCING_PROVIDER ?? "mock").toLowerCase();
  if (mode === "http") {
    return new HttpFinancingProvider(institution);
  }
  if (institution === "CAIXA") {
    return new MockCaixaFinancingProvider();
  }
  return new MockCaixaFinancingProvider();
}
