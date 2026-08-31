import { login, logout } from "@/domain/auth/service";
import { getSession } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";
import { assertLoginRateLimit } from "@/modules/go-live/rate-limit";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const body = loginSchema.parse(await request.json());
    const meta = getRequestMeta(request);
    await assertLoginRateLimit(meta.ip);
    const session = await login({
      ...body,
      ...meta,
      correlationId,
    });
    return jsonOk({
      user: {
        id: session.sub,
        email: session.email,
        fullName: session.fullName,
        role: session.role,
        tenantId: session.tenantId,
        correspondentId: session.correspondentId,
      },
    });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function DELETE(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const meta = getRequestMeta(request);
    await logout({ ...meta, correlationId });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function GET(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await getSession();
    if (!session) {
      return jsonOk({ user: null });
    }
    return jsonOk({
      user: {
        id: session.sub,
        email: session.email,
        fullName: session.fullName,
        role: session.role,
        tenantId: session.tenantId,
        correspondentId: session.correspondentId,
      },
    });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
