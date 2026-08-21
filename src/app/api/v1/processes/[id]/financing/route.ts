import { requirePermission } from "@/domain/auth/service";
import {
  listProcessFinancing,
  submitFinancingSchema,
  submitProcessFinancing,
} from "@/modules/financing-integrations/FinancingSubmissionService";
import { jsonCreated, jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("financing:read");
    const { id } = await params;
    const items = await listProcessFinancing(session, id);
    return jsonOk({ items });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("financing:write");
    const { id } = await params;
    const body = submitFinancingSchema.parse(await request.json().catch(() => ({})));
    const meta = getRequestMeta(request);
    const submission = await submitProcessFinancing(session, id, body, {
      ...meta,
      correlationId,
    });
    return jsonCreated(submission);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
