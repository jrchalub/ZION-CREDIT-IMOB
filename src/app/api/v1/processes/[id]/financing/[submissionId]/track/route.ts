import { requirePermission } from "@/domain/auth/service";
import { trackProcessFinancing } from "@/modules/financing-integrations/FinancingSubmissionService";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

type Params = { params: Promise<{ id: string; submissionId: string }> };

export async function POST(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("financing:write");
    const { id, submissionId } = await params;
    const meta = getRequestMeta(request);
    const submission = await trackProcessFinancing(session, id, submissionId, {
      ...meta,
      correlationId,
    });
    return jsonOk(submission);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
