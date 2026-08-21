import Link from "next/link";
import { requirePermission } from "@/domain/auth/service";
import { listProcesses } from "@/domain/processes/service";
import { hasPermission } from "@/domain/rbac/permissions";
import { StatusBadge } from "@/components/status-badge";
import { ProcessListActions } from "@/components/process-list-actions";
import {
  getAllowedTransitions,
  type ProcessStatus,
} from "@/domain/process/status-machine";
import { formatCpfDisplay, formatCurrency } from "@/lib/utils";

export default async function ProcessesPage() {
  const session = await requirePermission("processes:read");
  const data = await listProcesses(session, {
    page: 1,
    pageSize: 50,
    offset: 0,
  });

  const canWrite = hasPermission(session.role, "processes:write");
  const canTransition = hasPermission(session.role, "processes:transition");
  const isAdminDelete =
    session.role === "ADMIN" || session.role === "GESTOR";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-teal-700 uppercase">
            Pipeline
          </p>
          <h1 className="mt-1 font-serif text-3xl">
            {session.role === "CORRESPONDENTE" ? "Meus processos" : "Processos"}
          </h1>
        </div>
        {canWrite ? (
          <Link
            href="/processes/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Novo processo
          </Link>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Imóvel</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((process) => {
              const status = process.status as ProcessStatus;
              const canCancel =
                canTransition && getAllowedTransitions(status).includes("CANCELADO");
              const canHardDelete =
                canWrite &&
                (isAdminDelete || status === "NOVO" || status === "CANCELADO");

              return (
                <tr
                  key={process.id}
                  className="border-b border-slate-100 hover:bg-slate-50/80"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/processes/${process.id}`}
                      className="font-mono text-xs font-medium text-teal-800 hover:underline"
                    >
                      {process.processNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div>{process.clientName}</div>
                    <div className="font-mono text-xs text-slate-500">
                      {formatCpfDisplay(process.clientCpf)}
                    </div>
                  </td>
                  <td className="px-4 py-3">{process.incomeProfile}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={status} />
                  </td>
                  <td className="px-4 py-3">
                    {formatCurrency(process.propertyValue)}
                  </td>
                  <td className="px-4 py-3">
                    <ProcessListActions
                      processId={process.id}
                      processNumber={process.processNumber}
                      canWrite={canWrite}
                      canCancel={canCancel}
                      canHardDelete={canHardDelete}
                    />
                  </td>
                </tr>
              );
            })}
            {data.items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-slate-500" colSpan={6}>
                  Nenhum processo encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
