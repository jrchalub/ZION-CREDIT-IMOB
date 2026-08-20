import { requirePermission } from "@/domain/auth/service";
import {
  correctExtractedField,
  correctFieldSchema,
  getDocumentIntelligence,
} from "@/modules/document-intelligence/services/ReviewService";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("documents:read");
    const { id } = await params;
    const data = await getDocumentIntelligence(session, id);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("documents:review");
    const { id } = await params;
    const body = correctFieldSchema.parse(await request.json());
    getRequestMeta(request);
    const correction = await correctExtractedField(session, id, body, {
      correlationId,
    });
    return jsonOk(correction);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
