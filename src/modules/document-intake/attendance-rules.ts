import { AppError } from "@/lib/api";

export function assertSameTenant(sessionTenantId: string, entityTenantId: string) {
  if (sessionTenantId !== entityTenantId) {
    throw new AppError(403, "Acesso cross-tenant negado", "CROSS_TENANT");
  }
}
