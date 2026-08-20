import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { maskCpf } from "@/lib/cpf";

const SENSITIVE_KEYS = new Set([
  "cpf",
  "password",
  "passwordHash",
  "bankAccount",
  "rg",
  "token",
  "authorization",
]);

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key)) {
    if (key === "cpf" && typeof value === "string") return maskCpf(value);
    return "[REDACTED]";
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "object" && item !== null
        ? redactObject(item as Record<string, unknown>)
        : item,
    );
  }
  if (typeof value === "object" && value !== null) {
    return redactObject(value as Record<string, unknown>);
  }
  return value;
}

export function redactObject(
  input?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!input) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = redactValue(key, value);
  }
  return out;
}

export async function writeAuditLog(input: {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}) {
  await db.insert(auditLogs).values({
    tenantId: input.tenantId ?? null,
    userId: input.userId ?? null,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    oldValue: redactObject(input.oldValue),
    newValue: redactObject(input.newValue),
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    correlationId: input.correlationId ?? null,
  });
}
