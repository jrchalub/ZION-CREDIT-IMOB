import { requirePermission } from "@/domain/auth/service";
import {
  updatePendency,
  updatePendencySchema,
} from "@/domain/pendencies/service";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("pendencies:write");
    const { id } = await params;
    const body = updatePendencySchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const updated = await updatePendency(session, id, body, {
      ...meta,
      correlationId,
    });
    return jsonOk(updated);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
