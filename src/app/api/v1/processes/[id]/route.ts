import { requirePermission } from "@/domain/auth/service";
import {
  deleteProcess,
  getProcess,
  updateProcess,
  updateProcessSchema,
} from "@/domain/processes/service";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

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

export async function PATCH(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("processes:write");
    const { id } = await params;
    const body = updateProcessSchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const process = await updateProcess(session, id, body, {
      ...meta,
      correlationId,
    });
    return jsonOk(process);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("processes:write");
    const { id } = await params;
    const meta = getRequestMeta(request);
    const result = await deleteProcess(session, id, {
      ...meta,
      correlationId,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
