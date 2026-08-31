import { getRedis } from "@/infra/redis";
import { AppError } from "@/lib/api";
import { isRateLimited, loginRateLimitKey } from "./production-guards";

export async function assertLoginRateLimit(ip: string | null | undefined) {
  const max = Number(process.env.LOGIN_RATE_LIMIT_MAX ?? "10");
  const windowSec = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_SEC ?? "900");
  const key = loginRateLimitKey(ip);
  const redis = getRedis();
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }
  if (isRateLimited(count, max)) {
    throw new AppError(429, "Muitas tentativas de login. Aguarde e tente novamente.", "RATE_LIMITED");
  }
}
