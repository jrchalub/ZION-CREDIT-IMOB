import { Queue } from "bullmq";
import { getRedis } from "./redis";

export const QUEUE_NAMES = {
  documentProcessing: "document-processing",
  ocrProcessing: "ocr-processing",
  aiProcessing: "ai-processing",
  financialAnalysis: "financial-analysis",
  notifications: "notifications",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

const queues = new Map<string, Queue>();

export function getQueue(name: QueueName): Queue {
  const existing = queues.get(name);
  if (existing) return existing;

  const queue = new Queue(name, {
    connection: getRedis(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });
  queues.set(name, queue);
  return queue;
}

export async function enqueueDocumentProcessing(payload: {
  documentId: string;
  tenantId: string;
  processId: string;
  correlationId?: string;
}) {
  const queue = getQueue(QUEUE_NAMES.documentProcessing);
  await queue.add("process-document", payload, {
    // Unique per enqueue so reprocess works after a completed run
    jobId: `doc-${payload.documentId}-${Date.now()}`,
  });
}

export async function enqueueFinancialAnalysis(payload: {
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
}) {
  const queue = getQueue(QUEUE_NAMES.financialAnalysis);
  await queue.add("analyze-financial", payload, {
    jobId: `fin-${payload.processId}-${Date.now()}`,
  });
}
