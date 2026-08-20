import type {
  IntegrationProvider,
  IntegrationQueryInput,
  IntegrationQueryResult,
  IntegrationKind,
} from "./IntegrationProvider";

export class MockBureauProvider implements IntegrationProvider {
  readonly name = "mock-bureau";
  readonly kind = "BUREAU" as const;

  async query(input: IntegrationQueryInput): Promise<IntegrationQueryResult> {
    return {
      ok: true,
      providerRef: `mock-bureau-${Date.now()}`,
      summary: {
        source: "mock",
        kind: "BUREAU",
        indicative: "SEM_RESTRICAO_APARENTE",
        scoreBand: "NAO_APLICAVEL",
        notes:
          "Mock local — não é consulta real de bureau. Não usar para decisão bancária.",
        subjectHint: input.subjectHint ?? null,
        disclaimer:
          "Resultado fictício para operação/pré-análise. Zion Credit não aprova crédito.",
      },
    };
  }
}

export class MockBankReadProvider implements IntegrationProvider {
  readonly name = "mock-bank-read";
  readonly kind = "BANK_READ" as const;

  async query(input: IntegrationQueryInput): Promise<IntegrationQueryResult> {
    return {
      ok: true,
      providerRef: `mock-bank-${Date.now()}`,
      summary: {
        source: "mock",
        kind: "BANK_READ",
        accountsFound: 1,
        openFinanceStatus: "SIMULADO",
        notes:
          "Mock local — não conecta Open Finance / banco real.",
        subjectHint: input.subjectHint ?? null,
        disclaimer:
          "Leitura simulada. Envio institucional = FASE 7 FinancingProvider.",
      },
    };
  }
}

/**
 * Generic HTTP adapter — POST { kind, processId, subjectHint, metadata }.
 * Without URL → skipped (ok), same discipline as WhatsApp stub.
 */
export class HttpIntegrationProvider implements IntegrationProvider {
  readonly name: string;
  readonly kind: IntegrationKind;
  private readonly envUrlKey: string;
  private readonly envTokenKey: string;

  constructor(kind: IntegrationKind) {
    this.kind = kind;
    this.name = kind === "BUREAU" ? "http-bureau" : "http-bank-read";
    this.envUrlKey =
      kind === "BUREAU" ? "BUREAU_PROVIDER_URL" : "BANK_READ_PROVIDER_URL";
    this.envTokenKey =
      kind === "BUREAU" ? "BUREAU_PROVIDER_TOKEN" : "BANK_READ_PROVIDER_TOKEN";
  }

  async query(input: IntegrationQueryInput): Promise<IntegrationQueryResult> {
    const url = process.env[this.envUrlKey];
    if (!url) {
      return {
        ok: true,
        skipped: true,
        providerRef: `${this.name}-stub-${Date.now()}`,
        errorMessage: `${this.envUrlKey} not configured — stubbed`,
        summary: {
          source: "http-stub",
          kind: this.kind,
          skipped: true,
        },
      };
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env[this.envTokenKey]
            ? { Authorization: `Bearer ${process.env[this.envTokenKey]}` }
            : {}),
        },
        body: JSON.stringify({
          kind: input.kind,
          tenantId: input.tenantId,
          processId: input.processId,
          subjectHint: input.subjectHint,
          metadata: input.metadata,
        }),
      });

      if (!res.ok) {
        return {
          ok: false,
          errorMessage: `${this.name}_HTTP_${res.status}`,
          summary: { source: "http", kind: this.kind, httpStatus: res.status },
        };
      }

      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        ref?: string;
        summary?: Record<string, unknown>;
      };

      return {
        ok: true,
        providerRef: json.ref ?? json.id ?? `${this.name}-${Date.now()}`,
        summary: {
          source: "http",
          kind: this.kind,
          ...(json.summary ?? { rawKeys: Object.keys(json).slice(0, 20) }),
        },
      };
    } catch (error) {
      return {
        ok: false,
        errorMessage:
          error instanceof Error ? error.message : `${this.name}_FAILED`,
        summary: { source: "http", kind: this.kind, failed: true },
      };
    }
  }
}

export function getIntegrationProvider(
  kind: IntegrationKind,
): IntegrationProvider {
  const mode = (process.env.INTEGRATION_PROVIDER ?? "mock").toLowerCase();
  if (mode === "http") {
    return new HttpIntegrationProvider(kind);
  }
  return kind === "BUREAU"
    ? new MockBureauProvider()
    : new MockBankReadProvider();
}
