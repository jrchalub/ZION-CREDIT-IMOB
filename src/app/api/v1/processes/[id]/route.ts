import { requirePermission } from "@/domain/auth/service";
import { getProcess } from "@/domain/processes/service";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("processes:read");
    const { id } = await params;
    const process = await getProcess(session, id);
    return jsonOk(process);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
