import { requirePermission } from "@/domain/auth/service";
import {
  ensureChecklistExists,
  listChecklist,
  markChecklistNotApplicable,
} from "@/domain/documents/checklist";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId, getRequestMeta } from "@/lib/request";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("documents:read");
    const { id } = await params;
    const url = new URL(request.url);
    const ensure = url.searchParams.get("ensure") === "1";
    const hasCreditCard = url.searchParams.get("hasCreditCard") !== "0";
    const data = ensure
      ? await ensureChecklistExists(session, id, { hasCreditCard })
      : await listChecklist(session, id);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

const patchSchema = z.object({
  checklistItemId: z.uuid(),
  action: z.literal("NAO_APLICAVEL"),
  notes: z.string().max(500).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("documents:write");
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const item = await markChecklistNotApplicable(
      session,
      id,
      body.checklistItemId,
      body.notes,
    );
    getRequestMeta(request);
    return jsonOk(item);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
