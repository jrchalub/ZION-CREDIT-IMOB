import { describe, expect, it } from "vitest";
import {
  envCaixaCredentialsConfigured,
  envCaixaSdkEnabled,
  evaluateInstitutionalSend,
  tenantCaixaSdkEnabled,
} from "./caixa-send-gate";
import { getFinancingProvider } from "./providers";
import { ManualOtherBankProvider } from "./caixa-sdk-provider";

describe("FASE 7.1 caixa send gate", () => {
  it("blocks when client did not opt in", () => {
    const result = evaluateInstitutionalSend({
      envEnabled: true,
      tenantEnabled: true,
      processOptIn: false,
      channel: "CAIXA",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CLIENT_OPT_IN_REQUIRED");
  });

  it("blocks when client chose no bank", () => {
    const result = evaluateInstitutionalSend({
      envEnabled: true,
      tenantEnabled: true,
      processOptIn: true,
      channel: "NENHUM",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INSTITUTIONAL_CHANNEL_NONE");
  });

  it("allows other bank without Caixa SDK", () => {
    const result = evaluateInstitutionalSend({
      envEnabled: false,
      tenantEnabled: false,
      processOptIn: true,
      channel: "OUTRO",
    });
    expect(result).toEqual({ ok: true, mode: "outro" });
  });

  it("blocks Caixa when tenant disabled the option", () => {
    const result = evaluateInstitutionalSend({
      envEnabled: true,
      tenantEnabled: false,
      processOptIn: true,
      channel: "CAIXA",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_CAIXA_SDK_DISABLED");
  });

  it("allows Caixa mock in non-production when tenant+client opted in", () => {
    const result = evaluateInstitutionalSend({
      envEnabled: false,
      tenantEnabled: true,
      processOptIn: true,
      channel: "CAIXA",
      productionStrict: false,
    });
    expect(result).toEqual({ ok: true, mode: "caixa" });
  });

  it("blocks silent mock in production without env SDK", () => {
    const result = evaluateInstitutionalSend({
      envEnabled: false,
      tenantEnabled: true,
      processOptIn: true,
      channel: "CAIXA",
      productionStrict: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CAIXA_SDK_ENV_DISABLED");
  });

  it("reads tenant and env flags", () => {
    expect(tenantCaixaSdkEnabled({ caixaSdkEnabled: true })).toBe(true);
    expect(tenantCaixaSdkEnabled({})).toBe(false);
    expect(envCaixaSdkEnabled({ CAIXA_SDK_ENABLED: "true" })).toBe(true);
    expect(envCaixaSdkEnabled({ FINANCING_PROVIDER: "caixa-sdk" })).toBe(true);
    expect(
      envCaixaCredentialsConfigured({
        CAIXA_API_URL: "https://api.example",
        CAIXA_API_TOKEN: "t",
      }),
    ).toBe(true);
  });
});

describe("FASE 7.1 providers", () => {
  it("uses manual provider for other banks", async () => {
    const provider = new ManualOtherBankProvider();
    const result = await provider.submit({
      institution: "OUTRO",
      tenantId: "t1",
      processId: "11111111-1111-1111-1111-111111111111",
      proposal: { intendedBank: "Santander" },
    });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.summary.source).toBe("manual");
  });

  it("factory returns other-bank provider", () => {
    expect(getFinancingProvider("OUTRO").name).toBe("manual-other-bank");
  });
});
