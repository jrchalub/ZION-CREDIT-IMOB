import { describe, expect, it } from "vitest";
import {
  HttpIntegrationProvider,
  MockBankReadProvider,
  MockBureauProvider,
  getIntegrationProvider,
} from "./providers";

describe("IntegrationProvider adapters", () => {
  it("mock bureau returns non-decision indicative summary", async () => {
    const provider = new MockBureauProvider();
    const result = await provider.query({
      kind: "BUREAU",
      tenantId: "t1",
      processId: "p1",
      subjectHint: { cpfLast4: "4725", fullName: "Ana Paula" },
    });
    expect(result.ok).toBe(true);
    expect(result.summary.kind).toBe("BUREAU");
    expect(String(result.summary.disclaimer)).toMatch(/não aprova/i);
    expect(JSON.stringify(result.summary)).not.toMatch(/52998224725/);
  });

  it("mock bank read is simulated open finance only", async () => {
    const provider = new MockBankReadProvider();
    const result = await provider.query({
      kind: "BANK_READ",
      tenantId: "t1",
      processId: "p1",
    });
    expect(result.ok).toBe(true);
    expect(result.summary.openFinanceStatus).toBe("SIMULADO");
  });

  it("http provider stubs when URL missing", async () => {
    const prev = process.env.BUREAU_PROVIDER_URL;
    delete process.env.BUREAU_PROVIDER_URL;
    const provider = new HttpIntegrationProvider("BUREAU");
    const result = await provider.query({
      kind: "BUREAU",
      tenantId: "t1",
      processId: "p1",
    });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    if (prev) process.env.BUREAU_PROVIDER_URL = prev;
  });

  it("factory defaults to mock", () => {
    const prev = process.env.INTEGRATION_PROVIDER;
    delete process.env.INTEGRATION_PROVIDER;
    expect(getIntegrationProvider("BUREAU").name).toBe("mock-bureau");
    expect(getIntegrationProvider("BANK_READ").name).toBe("mock-bank-read");
    if (prev) process.env.INTEGRATION_PROVIDER = prev;
  });
});
