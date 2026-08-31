import { pingRedis } from "@/infra/redis";
import { getStorageProvider } from "@/infra/storage";
import { jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId } from "@/lib/request";
import { requireSession } from "@/lib/auth/session";
import { resolveOcrProviderName } from "@/modules/document-intelligence/ocr/ocr-provider-select";

export async function GET(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    await requireSession();
    const redisOk = await pingRedis().catch(() => false);
    let minioOk = false;
    try {
      await getStorageProvider().ensureBucket();
      minioOk = true;
    } catch {
      minioOk = false;
    }

    const ocr = resolveOcrProviderName({
      ocrProvider: process.env.OCR_PROVIDER,
      aiProvider: process.env.AI_PROVIDER,
    });

    return jsonOk({
      postgres: true,
      redis: redisOk,
      minio: minioOk,
      workersHint: "Rode `pnpm workers` em processo separado",
      aiProvider: process.env.AI_PROVIDER ?? "mock",
      ocrProvider: ocr,
      architecture: {
        database: "postgresql",
        orm: "drizzle",
        cache: "redis",
        queue: "bullmq",
        storage: "minio-s3-compatible",
        baas: "none",
      },
    });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
