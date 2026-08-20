import { describe, expect, it } from "vitest";
import {
  buildPortalDeepLink,
  buildPortalPath,
  getAppBaseUrl,
  normalizeWhatsAppRecipient,
} from "./deep-link";

describe("portal deep link", () => {
  it("builds path without putting CPF in token/url", () => {
    const token = "XyZ_opaque_token_value_32bytes_min__";
    const path = buildPortalPath(token);
    expect(path.startsWith("/portal/")).toBe(true);
    expect(path).not.toMatch(/\d{11}/);
  });

  it("builds absolute URL from APP_URL", () => {
    const prev = process.env.APP_URL;
    process.env.APP_URL = "https://app.zioncredit.demo/";
    expect(getAppBaseUrl()).toBe("https://app.zioncredit.demo");
    expect(buildPortalDeepLink("tok")).toBe(
      "https://app.zioncredit.demo/portal/tok",
    );
    if (prev === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = prev;
  });

  it("normalizes phone for WhatsApp recipient", () => {
    expect(normalizeWhatsAppRecipient("11 9 8765-4321")).toBe("11987654321");
  });
});
