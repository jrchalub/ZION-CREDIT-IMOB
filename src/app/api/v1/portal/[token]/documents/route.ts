import { uploadViaPortal } from "@/modules/operations/portal/ClientPortalService";
import { AppError, jsonCreated, jsonError } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

type Params = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const { token } = await params;
    const form = await request.formData();
    const file = form.get("file");
    const checklistItemId = form.get("checklistItemId");
    const documentDateRaw = form.get("documentDate");
    const documentDate =
      typeof documentDateRaw === "string" && documentDateRaw.trim()
        ? documentDateRaw.trim()
        : null;

    if (!(file instanceof File)) {
      throw new AppError(400, "Arquivo obrigatório", "FILE_REQUIRED");
    }
    if (typeof checklistItemId !== "string" || !checklistItemId) {
      throw new AppError(400, "checklistItemId obrigatório", "CHECKLIST_REQUIRED");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const meta = getRequestMeta(request);
    const result = await uploadViaPortal(
      decodeURIComponent(token),
      {
        checklistItemId,
        filename: file.name,
        declaredMime: file.type || "application/octet-stream",
        buffer,
        documentDate,
      },
      { ...meta, correlationId },
    );
    return jsonCreated(result);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
