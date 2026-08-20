import { z } from "zod";
import { requirePermission } from "@/domain/auth/service";
import { getProcess } from "@/domain/processes/service";
import { getProcessDossier } from "@/modules/credit-decision-support/services/DossierService";
import {
  getLatestDecisionSupport,
  runDecisionSupport,
} from "@/modules/credit-decision-support/services/DecisionSupportService";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

const postSchema = z.object({
  action: z.enum(["generate"]).default("generate"),
});

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("decision:read");
    const { id } = await params;
    await getProcess(session, id);
    const dossier = await getProcessDossier(session, id);
    const latest = await getLatestDecisionSupport(session.tenantId, id);
    return jsonOk({ ...dossier, latestDecisionSupport: latest });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("decision:write");
    const { id } = await params;
    await getProcess(session, id);
    postSchema.parse(await request.json().catch(() => ({})));

    const result = await runDecisionSupport({
      processId: id,
      tenantId: session.tenantId,
      userId: session.sub,
      correlationId,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
