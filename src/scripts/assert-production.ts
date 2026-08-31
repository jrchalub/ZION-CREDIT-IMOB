import "dotenv/config";
import {
  demoSeedAllowed,
  productionAuthSecretOk,
} from "@/modules/go-live/production-guards";

export function collectProductionIssues(
  env: Record<string, string | undefined>,
): string[] {
  const issues: string[] = [];
  if (!env.DATABASE_URL) issues.push("DATABASE_URL ausente");
  if (!env.REDIS_URL) issues.push("REDIS_URL ausente");
  if (!productionAuthSecretOk(env.AUTH_SECRET)) {
    issues.push("AUTH_SECRET deve ter ≥32 caracteres e não pode ser o valor de exemplo");
  }
  if (!env.APP_URL) {
    issues.push("APP_URL ausente");
  }
  if ((env.AI_PROVIDER === "openai" || env.OCR_PROVIDER === "openai") && !env.OPENAI_API_KEY) {
    issues.push("OPENAI_API_KEY ausente com provider openai");
  }
  if (!env.CRM_WEBHOOK_SECRET) {
    issues.push("CRM_WEBHOOK_SECRET ausente (webhook WhatsApp/CRM)");
  }
  if (!env.MINIO_ENDPOINT) issues.push("MINIO_ENDPOINT ausente");
  if (!env.MINIO_ACCESS_KEY) issues.push("MINIO_ACCESS_KEY ausente");
  if (!env.MINIO_SECRET_KEY) issues.push("MINIO_SECRET_KEY ausente");
  return issues;
}

export function assertProductionReady(env = process.env) {
  const issues = collectProductionIssues(env);
  if (issues.length > 0) {
    throw new Error(`Go-live bloqueado:\n- ${issues.join("\n- ")}`);
  }
  if (env.NODE_ENV === "production" && !demoSeedAllowed(env)) {
    console.log("Demo seed desabilitado (ok).");
  }
}

if (process.argv[1]?.includes("assert-production")) {
  try {
    assertProductionReady();
    console.log("Production env checks passed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
