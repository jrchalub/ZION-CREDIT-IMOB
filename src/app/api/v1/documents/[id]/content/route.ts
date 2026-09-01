import { requirePermission } from "@/domain/auth/service";
import { streamDocumentContent } from "@/domain/documents/service";
import { jsonError } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("documents:read");
    const { id } = await params;
    const meta = getRequestMeta(request);
    const { body, mimeType, filename } = await streamDocumentContent(session, id, {
      ...meta,
      correlationId,
    });

    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
