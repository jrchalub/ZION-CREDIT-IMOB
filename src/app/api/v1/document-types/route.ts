import { requirePermission } from "@/domain/auth/service";
import { listDocumentTypes } from "@/domain/documents/service";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId } from "@/lib/request";

export async function GET(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    await requirePermission("documents:read");
    const items = await listDocumentTypes();
    return jsonOk({ items });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
