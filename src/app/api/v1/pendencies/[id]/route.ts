import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/domain/rbac/permissions";
import {
  updatePendency,
  updatePendencySchema,
} from "@/domain/pendencies/service";
import { AppError, jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requireSession();
    if (
      !hasPermission(session.role, "pendencies:write") &&
      !hasPermission(session.role, "pendencies:respond")
    ) {
      throw new AppError(403, "Acesso negado", "FORBIDDEN");
    }
    const { id } = await params;
    const body = updatePendencySchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const updated = await updatePendency(session, id, body, {
      ...meta,
      correlationId,
    });
    return jsonOk(updated);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
