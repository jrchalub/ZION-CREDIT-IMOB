import { requirePermission } from "@/domain/auth/service";
import { getUser, updateUser, updateUserSchema } from "@/domain/users/service";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("users:read");
    const { id } = await params;
    const user = await getUser(session, id);
    return jsonOk(user);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("users:write");
    const { id } = await params;
    const body = updateUserSchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const user = await updateUser(session, id, body, { ...meta, correlationId });
    return jsonOk(user);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
