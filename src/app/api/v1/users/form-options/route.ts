import { requirePermission } from "@/domain/auth/service";
import { getUserFormOptions } from "@/domain/users/service";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId } from "@/lib/request";

export async function GET(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("users:write");
    const data = await getUserFormOptions(session);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
