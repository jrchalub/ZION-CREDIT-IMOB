import { requirePermission } from "@/domain/auth/service";
import {
  getProcess,
  transitionProcess,
  transitionProcessSchema,
} from "@/domain/processes/service";
import { onProcessStatusChanged } from "@/modules/operations/services/ProcessOpsHooks";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";
import type { ProcessStatus } from "@/domain/process/status-machine";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("processes:transition");
    const { id } = await params;
    const body = transitionProcessSchema.parse(await request.json());
    const meta = getRequestMeta(request);

    const current = await getProcess(session, id);
    const fromStatus = current.status as ProcessStatus;

    const process = await transitionProcess(session, id, body, {
      ...meta,
      correlationId,
    });

    // FASE 6 side-effects (SLA + notifications)
    await onProcessStatusChanged({
      tenantId: session.tenantId,
      processId: id,
      fromStatus,
      toStatus: body.toStatus as ProcessStatus,
      correlationId,
    }).catch(() => undefined);

    return jsonOk(process);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
