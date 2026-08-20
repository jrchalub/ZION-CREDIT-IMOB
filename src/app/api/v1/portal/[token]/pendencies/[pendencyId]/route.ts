import { z } from "zod";
import { respondPendencyViaPortal } from "@/modules/operations/portal/ClientPortalService";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

type Params = { params: Promise<{ token: string; pendencyId: string }> };

const bodySchema = z.object({
  status: z.literal("SUBMITTED").default("SUBMITTED"),
});

export async function PATCH(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const { token, pendencyId } = await params;
    bodySchema.parse(await request.json().catch(() => ({})));
    const meta = getRequestMeta(request);
    const updated = await respondPendencyViaPortal(
      decodeURIComponent(token),
      pendencyId,
      { ...meta, correlationId },
    );
    return jsonOk({
      id: updated.id,
      status: updated.status,
    });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
