import { requirePermission } from "@/domain/auth/service";
import { revokePortalAccess } from "@/modules/operations/portal/PortalAccessService";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

type Params = { params: Promise<{ id: string; tokenId: string }> };

export async function POST(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("processes:write");
    const { id, tokenId } = await params;
    const meta = getRequestMeta(request);
    const revoked = await revokePortalAccess(session, id, tokenId, {
      ...meta,
      correlationId,
    });
    return jsonOk({ id: revoked.id, revokedAt: revoked.revokedAt });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
