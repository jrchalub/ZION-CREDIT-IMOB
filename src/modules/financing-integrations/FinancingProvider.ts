/**
 * FASE 7 — institutional financing submit/track.
 * Domain never imports Caixa/Banco X SDKs — only this interface.
 */

export type FinancingInstitution = "CAIXA" | "OUTRO";

export type FinancingSubmitInput = {
  institution: FinancingInstitution;
  tenantId: string;
  processId: string;
  /** Compact redacted payload — no full CPF, no document binaries */
  proposal: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type FinancingTrackInput = {
  institution: FinancingInstitution;
  tenantId: string;
  processId: string;
  providerRef: string;
  metadata?: Record<string, unknown>;
};

export type FinancingProviderResult = {
  ok: boolean;
  skipped?: boolean;
  providerRef?: string;
  externalStatus?: string;
  errorMessage?: string;
  summary: Record<string, unknown>;
};

export interface FinancingProvider {
  readonly name: string;
  readonly institution: FinancingInstitution;
  submit(input: FinancingSubmitInput): Promise<FinancingProviderResult>;
  track(input: FinancingTrackInput): Promise<FinancingProviderResult>;
}
