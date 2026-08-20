import { and, count, desc, eq } from "drizzle-orm";
import { requirePermission } from "@/domain/auth/service";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { getPagination, jsonError, jsonOk } from "@/lib/api";
import { createCorrelationId } from "@/lib/request";

export async function GET(request: Request) {
  const correlationId = createCorrelationId(request);
  try {
    const session = await requirePermission("audit:read");
    const url = new URL(request.url);
    const pagination = getPagination(url.searchParams);
    const entity = url.searchParams.get("entity");
    const entityId = url.searchParams.get("entityId");

    const where = and(
      eq(auditLogs.tenantId, session.tenantId),
      entity ? eq(auditLogs.entity, entity) : undefined,
      entityId ? eq(auditLogs.entityId, entityId) : undefined,
    );

    const [items, totalRow] = await Promise.all([
      db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(pagination.pageSize)
        .offset(pagination.offset),
      db.select({ value: count() }).from(auditLogs).where(where),
    ]);

    return jsonOk({
      items,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: Number(totalRow[0]?.value ?? 0),
    });
  } catch (error) {
    return jsonError(error, correlationId);
  }
}
