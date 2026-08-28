import { Worker } from "bullmq";
import "dotenv/config";
import { getRedis } from "@/infra/redis";
import { QUEUE_NAMES } from "@/infra/queues";
import { processDocumentJob } from "@/modules/document-intelligence/services/DocumentProcessingService";
import { createLogger } from "@/lib/logger";

const log = createLogger("worker:document-processing");

export function startDocumentProcessingWorker() {
  const worker = new Worker(
    QUEUE_NAMES.documentProcessing,
    async (job) => {
      const { documentId, tenantId, processId, correlationId } = job.data as {
        documentId: string;
        tenantId: string;
        processId: string;
        correlationId?: string;
      };

      log.info("Job started", {
        jobId: job.id,
        documentId,
        attempt: job.attemptsMade + 1,
      });

      return processDocumentJob({
        documentId,
        tenantId,
        processId,
        correlationId,
        jobId: job.id ? `bull-${job.id}` : `doc-${documentId}-${Date.now()}`,
        attempt: job.attemptsMade + 1,
      }).then(async (result) => {
        try {
          const { organizeDocumentAfterProcessing } = await import(
            "@/modules/document-intake/DocumentOrganizerService"
          );
          await organizeDocumentAfterProcessing({
            documentId,
            tenantId,
            processId,
          });
        } catch (error) {
          log.error("Inbox organize failed", {
            documentId,
            message: error instanceof Error ? error.message : "unknown",
          });
        }
        return result;
      });
    },
    {
      connection: getRedis(),
      concurrency: Number(process.env.DOCUMENT_WORKER_CONCURRENCY ?? "2"),
    },
  );

  worker.on("failed", (job, err) => {
    log.error("Job failed", {
      jobId: job?.id,
      message: err.message,
    });
  });

  return worker;
}
