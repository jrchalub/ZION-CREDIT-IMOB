import { requirePermission } from "@/domain/auth/service";
import {
  createDocumentViewUrl,
  getDocumentForTenant,
  reviewDocument,
  reviewDocumentSchema,
} from "@/domain/documents/service";
import { AppError, jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("documents:read");
    const { id } = await params;
    const url = new URL(request.url);
    const meta = getRequestMeta(request);

    if (url.searchParams.get("view") === "1") {
      const signed = await createDocumentViewUrl(session, id, {
        ...meta,
        correlationId,
      });
      return jsonOk(signed);
    }

    const row = await getDocumentForTenant(session, id);
    return jsonOk({
      ...row.document,
      typeCode: row.typeCode,
      typeName: row.typeName,
    });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("documents:review");
    const { id } = await params;
    const body = reviewDocumentSchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const updated = await reviewDocument(session, id, body, {
      ...meta,
      correlationId,
    });
    return jsonOk(updated);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
