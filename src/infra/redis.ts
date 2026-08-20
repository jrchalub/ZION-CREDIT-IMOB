import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  zionRedis?: Redis;
};

export function getRedis(): Redis {
  if (!globalForRedis.zionRedis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is required");
    globalForRedis.zionRedis = new Redis(url, {
      maxRetriesPerRequest: null,
    });
  }
  return globalForRedis.zionRedis;
}

export async function pingRedis(): Promise<boolean> {
  const redis = getRedis();
  const result = await redis.ping();
  return result === "PONG";
}
