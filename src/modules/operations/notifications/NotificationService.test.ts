import { describe, expect, it } from "vitest";
import {
  MockNotificationProvider,
  MockWhatsAppNotificationProvider,
  WhatsAppNotificationProvider,
} from "./providers";
import {
  buildPendencyPortalMessage,
  buildStatusChangeMessage,
} from "./messages";
import {
  buildPortalDeepLink,
  normalizeWhatsAppRecipient,
} from "../portal/deep-link";

describe("NotificationService messages + WhatsApp", () => {
  it("mock email provider sends successfully", async () => {
    const provider = new MockNotificationProvider();
    const result = await provider.send({
      to: "ana@example.com",
      subject: "Teste",
      body: "Olá",
    });
    expect(result.ok).toBe(true);
    expect(result.providerMessageId).toMatch(/^mock-/);
  });

  it("mock whatsapp provider sends without external call", async () => {
    const provider = new MockWhatsAppNotificationProvider();
    const result = await provider.send({
      to: "5511987654321",
      body: "Pendência + link",
    });
    expect(result.ok).toBe(true);
    expect(result.providerMessageId).toMatch(/^mock-wa-/);
  });

  it("whatsapp stub skips when URL not configured", async () => {
    const prev = process.env.WHATSAPP_PROVIDER_URL;
    delete process.env.WHATSAPP_PROVIDER_URL;
    const provider = new WhatsAppNotificationProvider();
    const result = await provider.send({
      to: "5511987654321",
      body: "test",
    });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    if (prev) process.env.WHATSAPP_PROVIDER_URL = prev;
  });

  it("builds status change message for client", () => {
    const msg = buildStatusChangeMessage({
      clientName: "Ana Paula Martins Santos",
      processNumber: "PF-2026-000001",
      toStatusLabel: "Documentação pendente",
      operationalStageLabel: "Aguardando documentos",
    });
    expect(msg.subject).toContain("PF-2026-000001");
    expect(msg.body).toContain("Ana Paula Martins Santos");
    expect(msg.body).toContain("Aguardando documentos");
  });

  it("builds pendency WhatsApp message with portal deep link only", () => {
    const token = "a".repeat(43);
    const msg = buildPendencyPortalMessage({
      clientName: "Ana Paula Martins Santos",
      processNumber: "PF-2026-000001",
      title: "Novo comprovante de endereço",
      description: "Envie um comprovante atualizado",
      rawPortalToken: token,
    });
    expect(msg.body).toContain("Existe uma pendência");
    expect(msg.body).toContain(buildPortalDeepLink(token));
    expect(msg.body).not.toContain("renda");
    expect(msg.body).not.toContain("score");
    expect(msg.portalUrl).toContain("/portal/");
  });

  it("normalizes WhatsApp numbers without PII tokens", () => {
    expect(normalizeWhatsAppRecipient("(11) 98765-4321")).toBe("11987654321");
    expect(normalizeWhatsAppRecipient("+55 11 98765-4321")).toBe(
      "5511987654321",
    );
    expect(normalizeWhatsAppRecipient("abc")).toBeNull();
  });
});
