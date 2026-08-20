import { getClientPortalView } from "@/modules/operations/portal/ClientPortalService";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId } from "@/lib/request";

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const { token } = await params;
    const data = await getClientPortalView(decodeURIComponent(token));
    return jsonOk(data);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
