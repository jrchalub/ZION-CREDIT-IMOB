import Link from "next/link";
import { requirePermission } from "@/domain/auth/service";
import { listProcesses } from "@/domain/processes/service";
import { StatusBadge } from "@/components/status-badge";
import type { ProcessStatus } from "@/domain/process/status-machine";
import { formatCpfDisplay, formatCurrency } from "@/lib/utils";

export default async function ProcessesPage() {
  const session = await requirePermission("processes:read");
  const data = await listProcesses(session, {
    page: 1,
    pageSize: 50,
    offset: 0,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-teal-700 uppercase">
            Pipeline
          </p>
          <h1 className="mt-1 font-serif text-3xl">Processos</h1>
        </div>
        <Link
          href="/processes/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Novo processo
        </Link>
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
            </tr>
          </thead>
          <tbody>
            {data.items.map((process) => (
              <tr key={process.id} className="border-b border-slate-100 hover:bg-slate-50/80">
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
                  <StatusBadge status={process.status as ProcessStatus} />
                </td>
                <td className="px-4 py-3">
                  {formatCurrency(process.propertyValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
