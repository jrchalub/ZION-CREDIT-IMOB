import type {
  NotificationProvider,
  SendNotificationInput,
  SendNotificationResult,
} from "./NotificationProvider";

/** Dev/test provider — never calls external APIs. */
export class MockNotificationProvider implements NotificationProvider {
  readonly name = "mock";
  readonly channel = "EMAIL" as const;

  async send(_input: SendNotificationInput): Promise<SendNotificationResult> {
    return {
      ok: true,
      providerMessageId: `mock-${Date.now()}`,
      skipped: false,
    };
  }
}

export class MockWhatsAppNotificationProvider implements NotificationProvider {
  readonly name = "mock-whatsapp";
  readonly channel = "WHATSAPP" as const;

  async send(_input: SendNotificationInput): Promise<SendNotificationResult> {
    return {
      ok: true,
      providerMessageId: `mock-wa-${Date.now()}`,
      skipped: false,
    };
  }
}

/**
 * Email stub — ready for SMTP/API wiring later.
 * Without EMAIL_PROVIDER_URL, marks as skipped (ok).
 */
export class EmailNotificationProvider implements NotificationProvider {
  readonly name = "email";
  readonly channel = "EMAIL" as const;

  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    const url = process.env.EMAIL_PROVIDER_URL;
    if (!url) {
      return {
        ok: true,
        providerMessageId: `email-stub-${Date.now()}`,
        skipped: true,
        errorMessage: "EMAIL_PROVIDER_URL not configured — stubbed",
      };
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.EMAIL_PROVIDER_TOKEN
            ? { Authorization: `Bearer ${process.env.EMAIL_PROVIDER_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          to: input.to,
          subject: input.subject,
          body: input.body,
          metadata: input.metadata,
        }),
      });
      if (!res.ok) {
        return {
          ok: false,
          errorMessage: `EMAIL_HTTP_${res.status}`,
        };
      }
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        messageId?: string;
      };
      return {
        ok: true,
        providerMessageId: json.messageId ?? json.id ?? `email-${Date.now()}`,
      };
    } catch (error) {
      return {
        ok: false,
        errorMessage: error instanceof Error ? error.message : "EMAIL_SEND_FAILED",
      };
    }
  }
}

/**
 * WhatsApp HTTP adapter — notification + deep link only.
 * Does NOT upload/receive documents (FASE 6.5).
 *
 * Env:
 * - WHATSAPP_PROVIDER_URL — POST JSON { to, body, metadata }
 * - WHATSAPP_PROVIDER_TOKEN — optional Bearer
 * Without URL: stub (skipped) so local/dev still works.
 */
export class WhatsAppNotificationProvider implements NotificationProvider {
  readonly name = "whatsapp";
  readonly channel = "WHATSAPP" as const;

  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    const url = process.env.WHATSAPP_PROVIDER_URL;
    if (!url) {
      return {
        ok: true,
        providerMessageId: `wa-stub-${Date.now()}`,
        skipped: true,
        errorMessage: "WHATSAPP_PROVIDER_URL not configured — stubbed",
      };
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.WHATSAPP_PROVIDER_TOKEN
            ? { Authorization: `Bearer ${process.env.WHATSAPP_PROVIDER_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          to: input.to,
          body: input.body,
          subject: input.subject,
          metadata: {
            ...input.metadata,
            channel: "WHATSAPP",
            // Explicit: no document binary in WhatsApp path
            documentsAttached: false,
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          ok: false,
          errorMessage: `WHATSAPP_HTTP_${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
        };
      }

      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        messageId?: string;
      };
      return {
        ok: true,
        providerMessageId: json.messageId ?? json.id ?? `wa-${Date.now()}`,
      };
    } catch (error) {
      return {
        ok: false,
        errorMessage:
          error instanceof Error ? error.message : "WHATSAPP_SEND_FAILED",
      };
    }
  }
}

export function getNotificationProviders(): NotificationProvider[] {
  const mode = (process.env.NOTIFICATION_PROVIDER ?? "mock").toLowerCase();
  if (mode === "email") {
    return [new EmailNotificationProvider()];
  }
  if (mode === "whatsapp") {
    return [new WhatsAppNotificationProvider()];
  }
  if (mode === "all") {
    return [
      new EmailNotificationProvider(),
      new WhatsAppNotificationProvider(),
    ];
  }
  // mock: both channels locally without external calls
  return [new MockNotificationProvider(), new MockWhatsAppNotificationProvider()];
}
