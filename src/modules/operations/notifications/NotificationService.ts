import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import type { NotificationEventType } from "../workflow/operational-stages";
import { getNotificationProviders } from "./providers";
import type { NotificationChannel } from "./NotificationProvider";

export {
  buildStatusChangeMessage,
  buildPendencyPortalMessage,
} from "./messages";

export type NotifyInput = {
  tenantId: string;
  processId?: string;
  clientId?: string;
  eventType: NotificationEventType;
  /** Fallback recipient for all channels */
  recipient?: string | null;
  /** Per-channel recipients (WhatsApp phone vs email) */
  recipients?: Partial<Record<NotificationChannel, string | null | undefined>>;
  subject?: string;
  body: string;
  payload?: Record<string, unknown>;
  channels?: NotificationChannel[];
};

/**
 * Persists + dispatches notifications via configured providers.
 * Never mutates financing/credit domain — outbound side-effect only.
 */
export async function notify(input: NotifyInput) {
  const all = getNotificationProviders();
  const providers = input.channels
    ? all.filter((p) => input.channels!.includes(p.channel))
    : all;

  const results = [];

  for (const provider of providers) {
    const to =
      input.recipients?.[provider.channel] ?? input.recipient ?? null;

    if (!to) {
      results.push({
        notificationId: null as string | null,
        ok: true,
        skipped: true,
        errorMessage: `No recipient for ${provider.channel}`,
        channel: provider.channel,
      });
      continue;
    }

    const [row] = await db
      .insert(notifications)
      .values({
        tenantId: input.tenantId,
        processId: input.processId ?? null,
        clientId: input.clientId ?? null,
        eventType: input.eventType,
        channel: provider.channel,
        status: "QUEUED",
        recipient: to,
        subject: input.subject ?? null,
        body: input.body,
        payload: input.payload ?? {},
        provider: provider.name,
      })
      .returning();

    try {
      const result = await provider.send({
        to,
        subject: input.subject,
        body: input.body,
        metadata: {
          eventType: input.eventType,
          processId: input.processId,
          ...(input.payload ?? {}),
        },
      });

      await db
        .update(notifications)
        .set({
          status: result.ok ? (result.skipped ? "SKIPPED" : "SENT") : "FAILED",
          providerMessageId: result.providerMessageId ?? null,
          errorMessage: result.errorMessage ?? null,
          sentAt: result.ok && !result.skipped ? new Date() : null,
        })
        .where(eq(notifications.id, row.id));

      results.push({
        notificationId: row.id,
        ...result,
        channel: provider.channel,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "SEND_FAILED";
      await db
        .update(notifications)
        .set({ status: "FAILED", errorMessage: message })
        .where(eq(notifications.id, row.id));
      results.push({
        notificationId: row.id,
        ok: false,
        errorMessage: message,
        channel: provider.channel,
      });
    }
  }

  return results;
}
