import { requirePermission } from "@/domain/auth/service";
import {
  listProcessDocuments,
  uploadDocument,
} from "@/domain/documents/service";
import { AppError, jsonCreated, jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("documents:read");
    const { id } = await params;
    const rows = await listProcessDocuments(session, id);
    return jsonOk({
      items: rows.map((row) => ({
        ...row.document,
        typeCode: row.typeCode,
        typeName: row.typeName,
      })),
    });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("documents:write");
    const { id: processId } = await params;
    const form = await request.formData();
    const file = form.get("file");
    const checklistItemId = String(form.get("checklistItemId") ?? "");
    const documentDate = String(form.get("documentDate") ?? "").trim() || null;

    if (!(file instanceof File)) {
      throw new AppError(400, "Arquivo obrigatório", "FILE_REQUIRED");
    }
    if (!checklistItemId) {
      throw new AppError(400, "checklistItemId obrigatório", "CHECKLIST_REQUIRED");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const meta = getRequestMeta(request);
    const document = await uploadDocument(
      session,
      {
        processId,
        checklistItemId,
        filename: file.name,
        declaredMime: file.type || "application/octet-stream",
        buffer,
        documentDate,
      },
      { ...meta, correlationId },
    );
    return jsonCreated(document);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
