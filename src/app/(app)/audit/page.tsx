import { requirePermission } from "@/domain/auth/service";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export default async function AuditPage() {
  const session = await requirePermission("audit:read");

  const items = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.tenantId, session.tenantId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs tracking-[0.18em] text-teal-700 uppercase">
          Conformidade
        </p>
        <h1 className="mt-1 font-serif text-3xl">Auditoria</h1>
        <p className="mt-1 text-sm text-slate-600">
          Eventos do tenant com payloads redigidos (LGPD).
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Entidade</th>
              <th className="px-4 py-3">ID</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="px-4 py-3 whitespace-nowrap">
                  {new Date(item.createdAt).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3 font-medium">{item.action}</td>
                <td className="px-4 py-3">{item.entity}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">
                  {item.entityId ?? "—"}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-slate-500" colSpan={4}>
                  Nenhum evento registrado ainda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
