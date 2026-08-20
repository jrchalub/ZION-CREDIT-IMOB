import { requirePermission } from "@/domain/auth/service";
import { createClient, createClientSchema, listClients } from "@/domain/clients/service";
import { getPagination, jsonCreated, jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

export async function GET(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("clients:read");
    const url = new URL(request.url);
    const pagination = getPagination(url.searchParams);
    const q = url.searchParams.get("q") ?? undefined;
    const data = await listClients(session, { ...pagination, q });
    return jsonOk(data);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("clients:write");
    const body = createClientSchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const client = await createClient(session, body, { ...meta, correlationId });
    return jsonCreated(client);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
