import postgres from "postgres";
import Redis from "ioredis";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(name: string, fn: () => Promise<void>, attempts = 40) {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      await fn();
      console.log(`${name} ready (${i}/${attempts})`);
      return;
    } catch (error) {
      lastError = error;
      console.log(`${name} waiting (${i}/${attempts})...`);
      await sleep(2000);
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${name} did not become ready: ${detail}`);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  await waitFor("postgres", async () => {
    const client = postgres(databaseUrl, { max: 1, connect_timeout: 5 });
    try {
      await client`select 1`;
    } finally {
      await client.end({ timeout: 2 });
    }
  });

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    await waitFor("redis", async () => {
      const redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        lazyConnect: true,
      });
      try {
        await redis.connect();
        const pong = await redis.ping();
        if (pong !== "PONG") throw new Error("unexpected ping");
      } finally {
        await redis.quit();
      }
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
