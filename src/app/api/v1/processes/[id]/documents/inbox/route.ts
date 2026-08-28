import { z } from "zod";
import { requirePermission } from "@/domain/auth/service";
import { jsonCreated, jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";
import { assignInboxDocumentType } from "@/modules/document-intake/DocumentOrganizerService";
import { getDocumentInboxSummary } from "@/modules/document-intake/DocumentationCompletenessService";
import { uploadInboxDocuments } from "@/modules/document-intake/inbox";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("documents:read");
    const { id } = await params;
    const summary = await getDocumentInboxSummary(session, id);
    return jsonOk(summary);
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
    const collected: File[] = [];
    for (const value of form.getAll("files")) {
      if (value instanceof File) collected.push(value);
    }
    const single = form.get("file");
    if (single instanceof File) collected.push(single);
    const files = collected.filter((file) => file.size > 0);
    const meta = getRequestMeta(request);
    const result = await uploadInboxDocuments(
      session,
      processId,
      await Promise.all(
        files.map(async (file) => ({
          filename: file.name,
          declaredMime: file.type || "application/octet-stream",
          buffer: Buffer.from(await file.arrayBuffer()),
        })),
      ),
      { ...meta, correlationId },
    );
    return jsonCreated(result);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

const assignSchema = z.object({
  documentId: z.uuid(),
  documentTypeCode: z.string().min(2),
});

export async function PATCH(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("documents:write");
    const { id: processId } = await params;
    const body = assignSchema.parse(await request.json());
    await assignInboxDocumentType(
      session,
      processId,
      body.documentId,
      body.documentTypeCode,
      { correlationId },
    );
    const summary = await getDocumentInboxSummary(session, processId);
    return jsonOk(summary);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
