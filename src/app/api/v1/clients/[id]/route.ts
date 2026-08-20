import { requirePermission } from "@/domain/auth/service";
import { getClient, updateClient, updateClientSchema } from "@/domain/clients/service";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("clients:read");
    const { id } = await params;
    const client = await getClient(session, id);
    return jsonOk(client);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("clients:write");
    const { id } = await params;
    const body = updateClientSchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const client = await updateClient(session, id, body, { ...meta, correlationId });
    return jsonOk(client);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
