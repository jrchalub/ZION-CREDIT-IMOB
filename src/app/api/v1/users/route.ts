import { requirePermission } from "@/domain/auth/service";
import {
  createUser,
  createUserSchema,
  listUsers,
} from "@/domain/users/service";
import { getPagination, jsonCreated, jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

export async function GET(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("users:read");
    const url = new URL(request.url);
    const pagination = getPagination(url.searchParams);
    const q = url.searchParams.get("q") ?? undefined;
    const data = await listUsers(session, { ...pagination, q });
    return jsonOk(data);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("users:write");
    const body = createUserSchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const user = await createUser(session, body, { ...meta, correlationId });
    return jsonCreated(user);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
