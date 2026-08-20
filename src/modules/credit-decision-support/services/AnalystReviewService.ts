import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { creditAnalystReviews, decisionSupportSnapshots } from "@/db/schema";
import { writeAuditLog } from "@/domain/audit/service";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";

const decideSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "RETURNED"]),
  justification: z.string().min(10).max(4000),
  reviewId: z.uuid().optional(),
});

export type DecideInput = z.infer<typeof decideSchema>;
export { decideSchema };

/**
 * Human analyst review — justification mandatory for final decisions.
 * Bound to an immutable decision_support_snapshot.
 */
export async function startAnalystReview(
  session: SessionPayload,
  processId: string,
  meta?: { correlationId?: string },
) {
  const [snapshot] = await db
    .select()
    .from(decisionSupportSnapshots)
    .where(
      and(
        eq(decisionSupportSnapshots.processId, processId),
        eq(decisionSupportSnapshots.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(decisionSupportSnapshots.createdAt))
    .limit(1);

  if (!snapshot) {
    throw new AppError(
      400,
      "Gere o dossiê de decisão (Decision Support) antes de iniciar a revisão",
      "NO_DECISION_SUPPORT_SNAPSHOT",
    );
  }

  const [existing] = await db
    .select()
    .from(creditAnalystReviews)
    .where(
      and(
        eq(creditAnalystReviews.decisionSupportSnapshotId, snapshot.id),
        eq(creditAnalystReviews.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(creditAnalystReviews.createdAt))
    .limit(1);

  if (existing && ["APPROVED", "REJECTED", "RETURNED"].includes(existing.status)) {
    // New review cycle on same snapshot not allowed — regenerate decision support instead
    throw new AppError(
      409,
      "Já existe parecer definitivo neste snapshot. Regenere o Decision Support para nova revisão.",
      "REVIEW_ALREADY_DECIDED",
    );
  }

  if (existing && existing.status === "IN_REVIEW") {
    return existing;
  }

  if (existing && existing.status === "PENDING") {
    const [updated] = await db
      .update(creditAnalystReviews)
      .set({
        status: "IN_REVIEW",
        analystId: session.sub,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(creditAnalystReviews.id, existing.id))
      .returning();

    await writeAuditLog({
      tenantId: session.tenantId,
      userId: session.sub,
      action: "ANALYST_REVIEW_STARTED",
      entity: "credit_analyst_review",
      entityId: updated.id,
      newValue: {
        processId,
        snapshotId: snapshot.id,
        status: "IN_REVIEW",
      },
      correlationId: meta?.correlationId,
    });

    return updated;
  }

  const [created] = await db
    .insert(creditAnalystReviews)
    .values({
      tenantId: session.tenantId,
      processId,
      decisionSupportSnapshotId: snapshot.id,
      financialSnapshotId: snapshot.financialSnapshotId,
      status: "IN_REVIEW",
      analystId: session.sub,
      startedAt: new Date(),
    })
    .returning();

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "ANALYST_REVIEW_STARTED",
    entity: "credit_analyst_review",
    entityId: created.id,
    newValue: { processId, snapshotId: snapshot.id, status: "IN_REVIEW" },
    correlationId: meta?.correlationId,
  });

  return created;
}

export async function decideAnalystReview(
  session: SessionPayload,
  processId: string,
  input: DecideInput,
  meta?: { correlationId?: string },
) {
  const body = decideSchema.parse(input);

  let review;
  if (body.reviewId) {
    const [row] = await db
      .select()
      .from(creditAnalystReviews)
      .where(
        and(
          eq(creditAnalystReviews.id, body.reviewId),
          eq(creditAnalystReviews.processId, processId),
          eq(creditAnalystReviews.tenantId, session.tenantId),
        ),
      )
      .limit(1);
    review = row;
  } else {
    const [row] = await db
      .select()
      .from(creditAnalystReviews)
      .where(
        and(
          eq(creditAnalystReviews.processId, processId),
          eq(creditAnalystReviews.tenantId, session.tenantId),
        ),
      )
      .orderBy(desc(creditAnalystReviews.createdAt))
      .limit(1);
    review = row;
  }

  if (!review) {
    throw new AppError(404, "Revisão não encontrada", "REVIEW_NOT_FOUND");
  }

  if (["APPROVED", "REJECTED", "RETURNED"].includes(review.status)) {
    throw new AppError(
      409,
      "Parecer já decidido neste snapshot — histórico é imutável",
      "REVIEW_IMMUTABLE",
    );
  }

  const [updated] = await db
    .update(creditAnalystReviews)
    .set({
      status: body.decision,
      decision: body.decision,
      justification: body.justification,
      analystId: session.sub,
      decidedAt: new Date(),
      updatedAt: new Date(),
      startedAt: review.startedAt ?? new Date(),
    })
    .where(eq(creditAnalystReviews.id, review.id))
    .returning();

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "ANALYST_REVIEW_DECIDED",
    entity: "credit_analyst_review",
    entityId: updated.id,
    newValue: {
      processId,
      decision: body.decision,
      justification: body.justification,
      decisionSupportSnapshotId: review.decisionSupportSnapshotId,
      financialSnapshotId: review.financialSnapshotId,
      responsible: session.sub,
    },
    correlationId: meta?.correlationId,
  });

  return updated;
}

export async function listAnalystReviews(
  session: SessionPayload,
  processId: string,
) {
  return db
    .select()
    .from(creditAnalystReviews)
    .where(
      and(
        eq(creditAnalystReviews.processId, processId),
        eq(creditAnalystReviews.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(creditAnalystReviews.createdAt));
}
