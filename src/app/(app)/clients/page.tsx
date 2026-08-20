import Link from "next/link";
import { requirePermission } from "@/domain/auth/service";
import { listClients } from "@/domain/clients/service";
import { formatCpfDisplay, formatCurrency } from "@/lib/utils";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requirePermission("clients:read");
  const params = await searchParams;
  const data = await listClients(session, {
    page: 1,
    pageSize: 50,
    offset: 0,
    q: params.q,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-teal-700 uppercase">
            Cadastro
          </p>
          <h1 className="mt-1 font-serif text-3xl">Clientes</h1>
        </div>
        <Link
          href="/clients/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Novo cliente
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Buscar por nome, e-mail ou CPF"
          className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
        />
        <button
          type="submit"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
        >
          Buscar
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">CPF</th>
              <th className="px-4 py-3">Profissão</th>
              <th className="px-4 py-3">Renda declarada</th>
              <th className="px-4 py-3">Contato</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((client) => (
              <tr key={client.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <Link
                    href={`/clients/${client.id}`}
                    className="font-medium text-teal-800 hover:underline"
                  >
                    {client.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {formatCpfDisplay(client.cpf)}
                </td>
                <td className="px-4 py-3">{client.profession ?? "—"}</td>
                <td className="px-4 py-3">
                  {formatCurrency(client.declaredIncome)}
                </td>
                <td className="px-4 py-3">{client.whatsapp ?? client.phone ?? "—"}</td>
              </tr>
            ))}
            {data.items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-slate-500" colSpan={5}>
                  Nenhum cliente encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
