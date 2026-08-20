import { z } from "zod";
import { requirePermission } from "@/domain/auth/service";
import { getProcess } from "@/domain/processes/service";
import { enqueueFinancialAnalysis } from "@/infra/queues";
import {
  getLatestFinancialAnalysis,
  runFinancialAnalysis,
} from "@/modules/financial-analysis/services/FinancialAnalysisService";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  mode: z.enum(["enqueue", "sync"]).default("sync"),
  rent: z.number().nonnegative().optional(),
  otherCommitments: z.number().nonnegative().optional(),
  simulationOverride: z
    .object({
      termMonths: z.number().int().positive().optional(),
      annualRatePct: z.number().positive().optional(),
      amortizationSystem: z.enum(["SAC", "PRICE"]).optional(),
    })
    .optional(),
});

export async function GET(request: Request, { params }: Params) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("financial:read");
    const { id } = await params;
    await getProcess(session, id);
    const data = await getLatestFinancialAnalysis(session.tenantId, id);
    return jsonOk(data);
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
    const body = bodySchema.parse(await request.json().catch(() => ({})));

    if (body.mode === "enqueue") {
      await enqueueFinancialAnalysis({
        processId: id,
        tenantId: session.tenantId,
        correlationId,
        userId: session.sub,
        rent: body.rent,
        otherCommitments: body.otherCommitments,
        simulationOverride: body.simulationOverride,
      });
      return jsonOk({ queued: true });
    }

    const result = await runFinancialAnalysis({
      processId: id,
      tenantId: session.tenantId,
      correlationId,
      userId: session.sub,
      rent: body.rent,
      otherCommitments: body.otherCommitments,
      simulationOverride: body.simulationOverride,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
