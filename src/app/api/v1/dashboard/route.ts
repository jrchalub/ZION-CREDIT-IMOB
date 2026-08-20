import { requirePermission } from "@/domain/auth/service";
import { getDashboardMetrics } from "@/domain/processes/service";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId } from "@/lib/request";

export async function GET(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("dashboard:read");
    const metrics = await getDashboardMetrics(session);
    return jsonOk(metrics);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
