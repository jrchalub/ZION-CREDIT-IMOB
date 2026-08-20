import { requirePermission } from "@/domain/auth/service";
import {
  listProcessIntegrations,
  runIntegrationSchema,
  runProcessIntegration,
} from "@/modules/operations/integrations/IntegrationService";
import { jsonCreated, jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("integrations:read");
    const { id } = await params;
    const items = await listProcessIntegrations(session, id);
    return jsonOk({ items });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("integrations:write");
    const { id } = await params;
    const body = runIntegrationSchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const call = await runProcessIntegration(session, id, body.kind, {
      ...meta,
      correlationId,
    });
    return jsonCreated(call);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
