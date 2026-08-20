import { requirePermission } from "@/domain/auth/service";
import {
  createPendency,
  createPendencySchema,
  listPendencies,
} from "@/domain/pendencies/service";
import { AppError, jsonCreated, jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

export async function GET(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("pendencies:read");
    const url = new URL(request.url);
    const processId = url.searchParams.get("processId");
    if (!processId) {
      throw new AppError(400, "processId obrigatório", "PROCESS_ID_REQUIRED");
    }
    const items = await listPendencies(session, processId);
    return jsonOk({ items });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("pendencies:write");
    const body = createPendencySchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const created = await createPendency(session, body, {
      ...meta,
      correlationId,
    });
    return jsonCreated(created);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
