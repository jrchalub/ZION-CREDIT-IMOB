import { describe, expect, it } from "vitest";
import {
  MockCaixaFinancingProvider,
  getFinancingProvider,
} from "./providers";

describe("FinancingProvider mock", () => {
  it("submits with institutional analysis status", async () => {
    const provider = new MockCaixaFinancingProvider();
    const result = await provider.submit({
      institution: "CAIXA",
      tenantId: "t1",
      processId: "p1",
      proposal: { processNumber: "PF-2026-000001" },
    });
    expect(result.ok).toBe(true);
    expect(result.providerRef).toMatch(/^mock-caixa-/);
    expect(result.externalStatus).toBe("EM_ANALISE_INSTITUICAO");
    expect(result.summary.source).toBe("mock");
  });

  it("tracks without auto-approving", async () => {
    const provider = new MockCaixaFinancingProvider();
    const result = await provider.track({
      institution: "CAIXA",
      tenantId: "t1",
      processId: "p1",
      providerRef: "mock-caixa-1",
    });
    expect(result.ok).toBe(true);
    expect(result.externalStatus).toBe("EM_ANALISE_INSTITUICAO");
  });

  it("factory defaults to mock-caixa", () => {
    const provider = getFinancingProvider("CAIXA");
    expect(provider.name).toBe("mock-caixa");
  });
});
