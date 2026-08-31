import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { writeAuditLog } from "@/domain/audit/service";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";
import {
  envCaixaCredentialsConfigured,
  envCaixaSdkEnabled,
  tenantCaixaSdkEnabled,
} from "./caixa-send-gate";

export const patchTenantSettingsSchema = z.object({
  caixaSdkEnabled: z.boolean(),
});

export async function getTenantFinancingSettings(session: SessionPayload) {
  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      settings: tenants.settings,
    })
    .from(tenants)
    .where(eq(tenants.id, session.tenantId))
    .limit(1);

  if (!tenant) {
    throw new AppError(404, "Tenant não encontrado", "TENANT_NOT_FOUND");
  }

  const settings = (tenant.settings ?? {}) as Record<string, unknown>;
  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    caixaSdkEnabled: tenantCaixaSdkEnabled(settings),
    envCaixaSdkEnabled: envCaixaSdkEnabled(process.env),
    caixaCredentialsConfigured: envCaixaCredentialsConfigured(process.env),
  };
}

export async function patchTenantFinancingSettings(
  session: SessionPayload,
  input: z.infer<typeof patchTenantSettingsSchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const current = await getTenantFinancingSettings(session);
  const [tenant] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, session.tenantId))
    .limit(1);

  const previous = (tenant?.settings ?? {}) as Record<string, unknown>;
  const next = { ...previous, caixaSdkEnabled: input.caixaSdkEnabled };

  await db
    .update(tenants)
    .set({ settings: next, updatedAt: new Date() })
    .where(eq(tenants.id, session.tenantId));

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "UPDATE",
    entity: "tenant_settings",
    entityId: session.tenantId,
    oldValue: { caixaSdkEnabled: current.caixaSdkEnabled },
    newValue: { caixaSdkEnabled: input.caixaSdkEnabled },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return getTenantFinancingSettings(session);
}
