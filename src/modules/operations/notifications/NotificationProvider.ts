export type NotificationChannel = "EMAIL" | "WHATSAPP" | "SMS" | "PUSH" | "IN_APP";

export type SendNotificationInput = {
  to: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
};

export type SendNotificationResult = {
  ok: boolean;
  providerMessageId?: string;
  errorMessage?: string;
  skipped?: boolean;
};

/**
 * Decoupled notification provider — domain never imports a vendor SDK.
 */
export interface NotificationProvider {
  readonly name: string;
  readonly channel: NotificationChannel;
  send(input: SendNotificationInput): Promise<SendNotificationResult>;
}
