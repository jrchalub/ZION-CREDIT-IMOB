import { requirePermission } from "@/domain/auth/service";
import { getProcess } from "@/domain/processes/service";
import {
  decideAnalystReview,
  decideSchema,
  listAnalystReviews,
  startAnalystReview,
} from "@/modules/credit-decision-support/services/AnalystReviewService";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId } from "@/lib/request";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({
    action: z.literal("decide"),
    decision: z.enum(["APPROVED", "REJECTED", "RETURNED"]),
    justification: z.string().min(10).max(4000),
    reviewId: z.uuid().optional(),
  }),
]);

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("processes:read");
    const { id } = await params;
    await getProcess(session, id);
    const reviews = await listAnalystReviews(session, id);
    return jsonOk(reviews);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("processes:write");
    const { id } = await params;
    await getProcess(session, id);
    const body = postSchema.parse(await request.json());

    if (body.action === "start") {
      const review = await startAnalystReview(session, id, { correlationId });
      return jsonOk(review);
    }

    const review = await decideAnalystReview(
      session,
      id,
      decideSchema.parse({
        decision: body.decision,
        justification: body.justification,
        reviewId: body.reviewId,
      }),
      { correlationId },
    );
    return jsonOk(review);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
