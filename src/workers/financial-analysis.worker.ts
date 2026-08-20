import { Worker } from "bullmq";
import "dotenv/config";
import { getRedis } from "@/infra/redis";
import { QUEUE_NAMES } from "@/infra/queues";
import { runFinancialAnalysis } from "@/modules/financial-analysis/services/FinancialAnalysisService";
import { createLogger } from "@/lib/logger";

const log = createLogger("worker:financial-analysis");

export function startFinancialAnalysisWorker() {
  const worker = new Worker(
    QUEUE_NAMES.financialAnalysis,
    async (job) => {
      const data = job.data as {
        processId: string;
        tenantId: string;
        correlationId?: string;
        userId?: string;
        rent?: number;
        otherCommitments?: number;
        simulationOverride?: {
          termMonths?: number;
          annualRatePct?: number;
          amortizationSystem?: "SAC" | "PRICE";
        };
      };

      log.info("Job started", {
        jobId: job.id,
        processId: data.processId,
      });

      return runFinancialAnalysis({
        processId: data.processId,
        tenantId: data.tenantId,
        correlationId: data.correlationId,
        userId: data.userId,
        rent: data.rent,
        otherCommitments: data.otherCommitments,
        simulationOverride: data.simulationOverride,
      });
    },
    {
      connection: getRedis(),
      concurrency: Number(process.env.FINANCIAL_WORKER_CONCURRENCY ?? "2"),
    },
  );

  worker.on("failed", (job, err) => {
    log.error("Job failed", { jobId: job?.id, message: err.message });
  });

  return worker;
}
