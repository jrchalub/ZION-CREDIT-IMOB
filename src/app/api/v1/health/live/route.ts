import { jsonOk } from "@/lib/api";

/** Unauthenticated liveness — process is up. */
export async function GET() {
  return jsonOk({ ok: true, service: "zion-credit" });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
