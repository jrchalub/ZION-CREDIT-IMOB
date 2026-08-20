import "dotenv/config";
import { startDocumentProcessingWorker } from "./document-processing.worker";
import { startFinancialAnalysisWorker } from "./financial-analysis.worker";
import { createLogger } from "@/lib/logger";

const log = createLogger("workers");

async function main() {
  startDocumentProcessingWorker();
  startFinancialAnalysisWorker();
  log.info("All workers started", {
    queues: ["document-processing", "financial-analysis"],
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
