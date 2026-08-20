/**
 * FASE 6.6 — external read integrations.
 * Domain never imports Serasa/Caixa/etc SDKs.
 * FASE 7 = FinancingProvider (submit/track) — out of scope here.
 */

export type IntegrationKind = "BUREAU" | "BANK_READ";

export type IntegrationQueryInput = {
  kind: IntegrationKind;
  tenantId: string;
  processId: string;
  /** Masked / last-4 only — never full CPF in provider logs */
  subjectHint?: {
    clientId?: string;
    cpfLast4?: string;
    fullName?: string;
  };
  metadata?: Record<string, unknown>;
};

export type IntegrationQueryResult = {
  ok: boolean;
  skipped?: boolean;
  providerRef?: string;
  errorMessage?: string;
  /** Compact summary safe to persist (no raw bureau dump) */
  summary: Record<string, unknown>;
};

export interface IntegrationProvider {
  readonly name: string;
  readonly kind: IntegrationKind;
  query(input: IntegrationQueryInput): Promise<IntegrationQueryResult>;
}
