import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { debts } from "@/db/schema";
import { requirePermission } from "@/domain/auth/service";
import { getProcess } from "@/domain/processes/service";
import { writeAuditLog } from "@/domain/audit/service";
import { jsonCreated, jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

const createSchema = z.object({
  type: z.string().min(1),
  creditor: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  outstandingBalance: z.string().optional().nullable(),
  monthlyInstallment: z.string().min(1),
});

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("financial:read");
    const { id } = await params;
    await getProcess(session, id);
    const rows = await db
      .select()
      .from(debts)
      .where(and(eq(debts.processId, id), eq(debts.tenantId, session.tenantId)));
    return jsonOk(rows);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("financial:write");
    const { id } = await params;
    await getProcess(session, id);
    const body = createSchema.parse(await request.json());

    const [created] = await db
      .insert(debts)
      .values({
        tenantId: session.tenantId,
        processId: id,
        type: body.type,
        creditor: body.creditor ?? null,
        description: body.description ?? null,
        outstandingBalance: body.outstandingBalance ?? null,
        monthlyInstallment: body.monthlyInstallment,
        source: "manual",
      })
      .returning();

    await writeAuditLog({
      tenantId: session.tenantId,
      userId: session.sub,
      action: "DEBT_CREATED",
      entity: "process",
      entityId: id,
      newValue: { debtId: created.id, type: body.type },
      correlationId,
    });

    return jsonCreated(created);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
