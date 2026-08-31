import { requirePermission } from "@/domain/auth/service";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";
import {
  getTenantFinancingSettings,
  patchTenantFinancingSettings,
  patchTenantSettingsSchema,
} from "@/modules/financing-integrations/tenant-settings";

export async function GET(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("settings:write");
    const data = await getTenantFinancingSettings(session);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function PATCH(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("settings:write");
    const body = patchTenantSettingsSchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const data = await patchTenantFinancingSettings(session, body, {
      ...meta,
      correlationId,
    });
    return jsonOk(data);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
