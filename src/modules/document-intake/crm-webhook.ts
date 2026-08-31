import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  financingProcesses,
  processAttendance,
  tenants,
} from "@/db/schema";
import { writeAuditLog } from "@/domain/audit/service";
import { AppError } from "@/lib/api";
import { normalizeWhatsAppRecipient } from "@/modules/operations/portal/deep-link";
import { webhookSecretMatches } from "@/modules/go-live/production-guards";

export const crmWebhookSchema = z.object({
  tenantSlug: z.string().min(2).max(80),
  conversationId: z.string().min(1).max(200),
  phone: z.string().min(8).max(30),
  occurredAt: z.string().datetime().optional().nullable(),
  processNumber: z.string().max(40).optional().nullable(),
  processId: z.uuid().optional().nullable(),
});

export function readWebhookSecret(request: Request): string | null {
  return (
    request.headers.get("x-zion-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null
  );
}

export function assertCrmWebhookAuthorized(request: Request) {
  const expected = process.env.CRM_WEBHOOK_SECRET;
  if (!webhookSecretMatches(readWebhookSecret(request), expected)) {
    throw new AppError(401, "Webhook não autorizado", "WEBHOOK_UNAUTHORIZED");
  }
}

export async function ingestCrmWhatsAppEvent(
  input: z.infer<typeof crmWebhookSchema>,
) {
  const phone = normalizeWhatsAppRecipient(input.phone);
  if (!phone) {
    throw new AppError(400, "Telefone WhatsApp inválido", "INVALID_PHONE");
  }

  const [tenant] = await db
    .select({ id: tenants.id, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.slug, input.tenantSlug))
    .limit(1);
  if (!tenant) throw new AppError(404, "Tenant não encontrado", "TENANT_NOT_FOUND");

  const clientRows = await db
    .select({
      id: clients.id,
      tenantId: clients.tenantId,
      whatsapp: clients.whatsapp,
      phone: clients.phone,
    })
    .from(clients)
    .where(eq(clients.tenantId, tenant.id));

  const client = clientRows.find((row) => {
    const candidates = [row.whatsapp, row.phone]
      .map((value) => normalizeWhatsAppRecipient(value))
      .filter((value): value is string => Boolean(value));
    return candidates.some(
      (stored) => stored === phone || stored.slice(-11) === phone.slice(-11),
    );
  });

  if (!client) {
    throw new AppError(404, "Cliente não encontrado para este WhatsApp", "CLIENT_NOT_FOUND");
  }

  let processId = input.processId ?? null;
  if (!processId && input.processNumber) {
    const [proc] = await db
      .select({ id: financingProcesses.id })
      .from(financingProcesses)
      .where(
        and(
          eq(financingProcesses.tenantId, tenant.id),
          eq(financingProcesses.processNumber, input.processNumber),
        ),
      )
      .limit(1);
    processId = proc?.id ?? null;
  }
  if (!processId) {
    const [proc] = await db
      .select({ id: financingProcesses.id })
      .from(financingProcesses)
      .where(
        and(
          eq(financingProcesses.tenantId, tenant.id),
          eq(financingProcesses.clientId, client.id),
        ),
      )
      .orderBy(desc(financingProcesses.openedAt))
      .limit(1);
    processId = proc?.id ?? null;
  }

  if (!processId) {
    throw new AppError(404, "Nenhum processo para vincular este atendimento", "PROCESS_NOT_FOUND");
  }

  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  const [existing] = await db
    .select()
    .from(processAttendance)
    .where(
      and(
        eq(processAttendance.tenantId, tenant.id),
        eq(processAttendance.processId, processId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(processAttendance)
      .set({
        externalConversationId: input.conversationId,
        lastInteractionAt: occurredAt,
        updatedAt: new Date(),
      })
      .where(eq(processAttendance.id, existing.id));
  } else {
    await db.insert(processAttendance).values({
      tenantId: tenant.id,
      processId,
      externalConversationId: input.conversationId,
      lastInteractionAt: occurredAt,
    });
  }

  await writeAuditLog({
    tenantId: tenant.id,
    action: "CRM_WEBHOOK",
    entity: "process_attendance",
    entityId: processId,
    newValue: {
      conversationId: input.conversationId,
      phoneLast4: phone.slice(-4),
    },
  });

  return {
    tenantId: tenant.id,
    clientId: client.id,
    processId,
    linked: true,
  };
}
