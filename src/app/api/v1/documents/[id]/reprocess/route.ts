import { requirePermission } from "@/domain/auth/service";
import { processDocumentJob } from "@/modules/document-intelligence/services/DocumentProcessingService";
import { getDocumentForTenant } from "@/domain/documents/service";
import { enqueueDocumentProcessing } from "@/infra/queues";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId } from "@/lib/request";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  mode: z.enum(["enqueue", "sync"]).default("enqueue"),
});

export async function POST(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("documents:review");
    const { id } = await params;
    const doc = await getDocumentForTenant(session, id);
    const body = bodySchema.parse(await request.json().catch(() => ({})));

    if (body.mode === "sync") {
      const result = await processDocumentJob({
        documentId: id,
        tenantId: session.tenantId,
        processId: doc.document.processId,
        correlationId,
        jobId: `doc-${id}-sync-${Date.now()}`,
      });
      return jsonOk(result);
    }

    await enqueueDocumentProcessing({
      documentId: id,
      tenantId: session.tenantId,
      processId: doc.document.processId,
      correlationId,
    });
    return jsonOk({ queued: true });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
