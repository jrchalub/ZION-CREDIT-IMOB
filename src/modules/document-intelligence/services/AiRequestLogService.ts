import { createHash } from "node:crypto";
import { db } from "@/db";
import { aiRequests, aiResponses } from "@/db/schema";

export async function logAiRequest(input: {
  tenantId: string;
  documentId?: string | null;
  processingRunId?: string | null;
  provider: string;
  model?: string;
  operation: string;
  promptVersion?: string;
  requestPayloadHashSource?: string;
  status: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: string;
  durationMs?: number;
  summary?: Record<string, unknown>;
  rawValid?: boolean;
  errorMessage?: string;
}) {
  const requestHash = input.requestPayloadHashSource
    ? createHash("sha256")
        .update(input.requestPayloadHashSource)
        .digest("hex")
        .slice(0, 32)
    : null;

  const [request] = await db
    .insert(aiRequests)
    .values({
      tenantId: input.tenantId,
      documentId: input.documentId ?? null,
      processingRunId: input.processingRunId ?? null,
      provider: input.provider,
      model: input.model ?? null,
      operation: input.operation,
      promptVersion: input.promptVersion ?? null,
      requestHash,
      status: input.status,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      estimatedCost: input.estimatedCost ?? null,
      durationMs: input.durationMs ?? null,
    })
    .returning();

  await db.insert(aiResponses).values({
    tenantId: input.tenantId,
    aiRequestId: request.id,
    status: input.status,
    summary: input.summary ?? {},
    rawValid: input.rawValid ?? true,
    errorMessage: input.errorMessage ?? null,
  });

  return request;
}
