import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/domain/auth/service";
import { getClient } from "@/domain/clients/service";
import { AppError } from "@/lib/api";
import { formatCpfDisplay, formatCurrency } from "@/lib/utils";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("clients:read");
  const { id } = await params;

  let client;
  try {
    client = await getClient(session, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  const address = client.addresses.find((a) => a.isPrimary) ?? client.addresses[0];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/clients" className="text-sm text-teal-800 hover:underline">
          ← Clientes
        </Link>
        <h1 className="mt-2 font-serif text-3xl">{client.fullName}</h1>
        <p className="mt-1 font-mono text-sm text-slate-600">
          CPF {formatCpfDisplay(client.cpf)}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl">Cadastro</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Profissão</dt>
              <dd>{client.profession ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Ocupação</dt>
              <dd>{client.occupationType ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Estado civil</dt>
              <dd>{client.maritalStatus ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Nascimento</dt>
              <dd>{client.birthDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">E-mail</dt>
              <dd>{client.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">WhatsApp</dt>
              <dd>{client.whatsapp ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl">Financeiro declarado</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Renda declarada</dt>
              <dd>{formatCurrency(client.declaredIncome)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">FGTS</dt>
              <dd>{formatCurrency(client.fgtsBalance)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Entrada disponível</dt>
              <dd>{formatCurrency(client.downPaymentAvailable)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Banco principal</dt>
              <dd>{client.primaryBank ?? "—"}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Valores declarados pelo cliente. Não constituem renda comprovada nem
            aprovação de crédito.
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="font-serif text-xl">Endereço</h2>
          {address ? (
            <p className="mt-3 text-sm text-slate-700">
              {address.street}
              {address.number ? `, ${address.number}` : ""}
              {address.complement ? ` — ${address.complement}` : ""}
              <br />
              {address.neighborhood ? `${address.neighborhood} · ` : ""}
              {address.city}/{address.state} · CEP {address.zipCode}
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Sem endereço cadastrado.</p>
          )}
        </section>
      </div>
    </div>
  );
}
