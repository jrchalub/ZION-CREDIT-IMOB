import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const databaseUrl: string = connectionString;

const globalForDb = globalThis as unknown as {
  postgresClient?: ReturnType<typeof postgres>;
  postgresConnectionString?: string;
};

function createClient() {
  return postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

let client = globalForDb.postgresClient;

if (!client || globalForDb.postgresConnectionString !== databaseUrl) {
  // Recreate when DATABASE_URL changes (avoids stale user/password after env updates)
  if (client) {
    void client.end({ timeout: 1 }).catch(() => undefined);
  }
  client = createClient();
  if (process.env.NODE_ENV !== "production") {
    globalForDb.postgresClient = client;
    globalForDb.postgresConnectionString = databaseUrl;
  }
}

export const db = drizzle(client, { schema });
export type Database = typeof db;
