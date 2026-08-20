/** Builds absolute portal deep links — never embed PII in the token/path. */

export function getAppBaseUrl(): string {
  const raw = (process.env.APP_URL ?? "http://localhost:3000").trim();
  return raw.replace(/\/+$/, "");
}

export function buildPortalPath(rawToken: string): string {
  return `/portal/${encodeURIComponent(rawToken)}`;
}

export function buildPortalDeepLink(rawToken: string): string {
  return `${getAppBaseUrl()}${buildPortalPath(rawToken)}`;
}

/** Digits-only phone for WhatsApp (keeps country code if present). */
export function normalizeWhatsAppRecipient(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits;
}
