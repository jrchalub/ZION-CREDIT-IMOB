import { requirePermission } from "@/domain/auth/service";
import { getOperationalDashboard } from "@/modules/operations/services/OperationalDashboardService";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId } from "@/lib/request";

export async function GET(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("operations:read");
    const data = await getOperationalDashboard(session.tenantId);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
