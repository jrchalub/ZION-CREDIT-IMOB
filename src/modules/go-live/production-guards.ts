import { timingSafeEqual } from "node:crypto";

export function loginRateLimitKey(ip: string | null | undefined): string {
  return `rl:login:${ip?.trim() || "unknown"}`;
}

export function isRateLimited(count: number, max: number): boolean {
  return count > max;
}

export function productionAuthSecretOk(secret: string | undefined): boolean {
  if (!secret || secret.length < 32) return false;
  if (secret.includes("change-me")) return false;
  return true;
}

export function demoSeedAllowed(env: {
  NODE_ENV?: string;
  ALLOW_DEMO_SEED?: string;
}): boolean {
  if (env.NODE_ENV === "production" && env.ALLOW_DEMO_SEED !== "true") {
    return false;
  }
  return true;
}

export function webhookSecretMatches(
  provided: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
