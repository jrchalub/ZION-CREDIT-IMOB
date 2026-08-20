import { requirePermission } from "@/domain/auth/service";
import { getProcessOperationalView } from "@/modules/operations/services/ProcessOperationalView";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("processes:read");
    const { id } = await params;
    const data = await getProcessOperationalView(session, id);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
