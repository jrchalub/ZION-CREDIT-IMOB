import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bankTransactions, transactionClassifications } from "@/db/schema";
import { requirePermission } from "@/domain/auth/service";
import { writeAuditLog } from "@/domain/audit/service";
import { AppError, jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  category: z.enum([
    "INCOME_PROBABLE",
    "SALARY",
    "OWN_TRANSFER",
    "LOAN",
    "REFUND",
    "CARD_PAYMENT",
    "EXPENSE",
    "FEE",
    "UNKNOWN",
  ]),
  reason: z.string().max(1000).optional().nullable(),
});

export async function PATCH(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("financial:write");
    const { id } = await params;
    const body = bodySchema.parse(await request.json());

    const [tx] = await db
      .select()
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.id, id),
          eq(bankTransactions.tenantId, session.tenantId),
        ),
      )
      .limit(1);

    if (!tx) {
      throw new AppError(404, "Transação não encontrada", "TX_NOT_FOUND");
    }

    const previousCategory = tx.category;

    await db
      .update(bankTransactions)
      .set({
        category: body.category,
        classificationConfidence: "1.0000",
      })
      .where(eq(bankTransactions.id, id));

    const [existing] = await db
      .select()
      .from(transactionClassifications)
      .where(eq(transactionClassifications.bankTransactionId, id))
      .limit(1);

    if (existing) {
      await db
        .update(transactionClassifications)
        .set({
          category: body.category,
          confidence: "1.0000",
          source: "human",
          ruleId: "human-override",
          overridden: true,
          previousCategory,
          overriddenByUserId: session.sub,
          reason: body.reason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(transactionClassifications.id, existing.id));
    } else {
      await db.insert(transactionClassifications).values({
        tenantId: session.tenantId,
        bankTransactionId: id,
        category: body.category,
        confidence: "1.0000",
        source: "human",
        ruleId: "human-override",
        overridden: true,
        previousCategory,
        overriddenByUserId: session.sub,
        reason: body.reason ?? null,
      });
    }

    await writeAuditLog({
      tenantId: session.tenantId,
      userId: session.sub,
      action: "TRANSACTION_CATEGORY_OVERRIDDEN",
      entity: "bank_transaction",
      entityId: id,
      oldValue: { category: previousCategory },
      newValue: { category: body.category, reason: body.reason ?? null },
      correlationId,
    });

    return jsonOk({ id, category: body.category });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
