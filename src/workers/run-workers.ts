import "dotenv/config";
import { startDocumentProcessingWorker } from "./document-processing.worker";
import { startFinancialAnalysisWorker } from "./financial-analysis.worker";
import { createLogger } from "@/lib/logger";

const log = createLogger("workers");

async function main() {
  const documentWorker = startDocumentProcessingWorker();
  const financialWorker = startFinancialAnalysisWorker();
  log.info("All workers started", {
    queues: ["document-processing", "financial-analysis"],
  });

  const shutdown = async (signal: string) => {
    log.info("Shutting down workers", { signal });
    await Promise.all([documentWorker.close(), financialWorker.close()]);
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
