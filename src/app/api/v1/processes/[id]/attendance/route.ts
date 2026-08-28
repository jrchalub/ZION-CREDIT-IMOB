import { requirePermission } from "@/domain/auth/service";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";
import {
  getProcessAttendance,
  updateAttendanceSchema,
  updateProcessAttendance,
} from "@/modules/document-intake/attendance";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("processes:read");
    const { id } = await params;
    const data = await getProcessAttendance(session, id);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("processes:write");
    const { id } = await params;
    const body = updateAttendanceSchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const data = await updateProcessAttendance(session, id, body, {
      ...meta,
      correlationId,
    });
    return jsonOk(data);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
