import { sql } from "drizzle-orm";
import { db } from "@/db";
import { pingRedis } from "@/infra/redis";
import { jsonOk } from "@/lib/api";
import { NextResponse } from "next/server";

/** Unauthenticated readiness — dependencies the app needs to serve traffic. */
export async function GET() {
  const redis = await pingRedis().catch(() => false);
  let postgres = false;
  try {
    await db.execute(sql`select 1`);
    postgres = true;
  } catch {
    postgres = false;
  }

  const ok = redis && postgres;
  const payload = { ok, redis, postgres };
  if (!ok) {
    return NextResponse.json({ data: payload }, { status: 503 });
  }
  return jsonOk(payload);
}
