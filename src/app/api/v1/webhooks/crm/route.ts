import { jsonCreated, jsonError } from "@/lib/api";
import { createCorrelationId } from "@/lib/request";
import {
  assertCrmWebhookAuthorized,
  crmWebhookSchema,
  ingestCrmWhatsAppEvent,
} from "@/modules/document-intake/crm-webhook";

export async function POST(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    assertCrmWebhookAuthorized(request);
    const body = crmWebhookSchema.parse(await request.json());
    const result = await ingestCrmWhatsAppEvent(body);
    return jsonCreated(result);
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
