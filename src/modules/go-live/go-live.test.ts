import { describe, expect, it } from "vitest";
import {
  collectProductionIssues,
} from "@/scripts/assert-production";
import {
  demoSeedAllowed,
  isRateLimited,
  loginRateLimitKey,
  productionAuthSecretOk,
  webhookSecretMatches,
} from "./production-guards";
import { resolveOcrProviderName, visionMimeFromDocument } from "@/modules/document-intelligence/ocr/ocr-provider-select";
import { readWebhookSecret } from "@/modules/document-intake/crm-webhook";

describe("OCR provider select", () => {
  it("uses OCR_PROVIDER when set", () => {
    expect(
      resolveOcrProviderName({ ocrProvider: "openai", aiProvider: "mock" }),
    ).toBe("openai");
    expect(
      resolveOcrProviderName({ ocrProvider: "mock", aiProvider: "openai" }),
    ).toBe("mock");
  });

  it("falls back to AI_PROVIDER", () => {
    expect(resolveOcrProviderName({ aiProvider: "openai" })).toBe("openai");
    expect(resolveOcrProviderName({})).toBe("mock");
  });

  it("maps vision mime types", () => {
    expect(visionMimeFromDocument("image/jpeg")).toBe("image/jpeg");
    expect(visionMimeFromDocument("application/pdf")).toBeNull();
  });
});

describe("production guards", () => {
  it("rejects short or example AUTH_SECRET", () => {
    expect(productionAuthSecretOk(undefined)).toBe(false);
    expect(productionAuthSecretOk("short")).toBe(false);
    expect(productionAuthSecretOk("change-me-to-a-long-random-secret-at-least-32-chars")).toBe(
      false,
    );
    expect(productionAuthSecretOk("a".repeat(32))).toBe(true);
  });

  it("blocks demo seed in production unless ALLOW_DEMO_SEED", () => {
    expect(demoSeedAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(demoSeedAllowed({ NODE_ENV: "production", ALLOW_DEMO_SEED: "true" })).toBe(
      true,
    );
    expect(demoSeedAllowed({ NODE_ENV: "development" })).toBe(true);
  });

  it("rate-limit key and threshold", () => {
    expect(loginRateLimitKey("1.2.3.4")).toBe("rl:login:1.2.3.4");
    expect(isRateLimited(10, 10)).toBe(false);
    expect(isRateLimited(11, 10)).toBe(true);
  });

  it("compares webhook secrets", () => {
    expect(webhookSecretMatches("abc", "abc")).toBe(true);
    expect(webhookSecretMatches("abc", "abd")).toBe(false);
    expect(webhookSecretMatches("abc", undefined)).toBe(false);
  });
});

describe("assert-production", () => {
  it("lists missing production env", () => {
    const issues = collectProductionIssues({});
    expect(issues.some((item) => item.includes("DATABASE_URL"))).toBe(true);
    expect(issues.some((item) => item.includes("AUTH_SECRET"))).toBe(true);
    expect(issues.some((item) => item.includes("CRM_WEBHOOK_SECRET"))).toBe(true);
  });

  it("requires OpenAI key when provider is openai", () => {
    const issues = collectProductionIssues({
      DATABASE_URL: "postgres://x",
      REDIS_URL: "redis://x",
      AUTH_SECRET: "a".repeat(32),
      APP_URL: "https://app.example",
      CRM_WEBHOOK_SECRET: "secret",
      MINIO_ENDPOINT: "minio",
      MINIO_ACCESS_KEY: "k",
      MINIO_SECRET_KEY: "s",
      AI_PROVIDER: "openai",
    });
    expect(issues.some((item) => item.includes("OPENAI_API_KEY"))).toBe(true);
  });
});

describe("crm webhook secret header", () => {
  it("reads x-zion-webhook-secret or Bearer", () => {
    const a = new Request("http://localhost/api/v1/webhooks/crm", {
      headers: { "x-zion-webhook-secret": "s1" },
    });
    expect(readWebhookSecret(a)).toBe("s1");
    const b = new Request("http://localhost/api/v1/webhooks/crm", {
      headers: { authorization: "Bearer s2" },
    });
    expect(readWebhookSecret(b)).toBe("s2");
  });
});
