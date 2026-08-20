import { requirePermission } from "@/domain/auth/service";
import {
  transitionProcess,
  transitionProcessSchema,
} from "@/domain/processes/service";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("processes:transition");
    const { id } = await params;
    const body = transitionProcessSchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const process = await transitionProcess(session, id, body, {
      ...meta,
      correlationId,
    });
    return jsonOk(process);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
