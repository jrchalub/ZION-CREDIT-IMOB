import Link from "next/link";
import { requirePermission } from "@/domain/auth/service";
import { listUsers, roleLabel } from "@/domain/users/service";
import { formatDateTime } from "@/lib/utils";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requirePermission("users:read");
  const params = await searchParams;
  const data = await listUsers(session, {
    page: 1,
    pageSize: 50,
    offset: 0,
    q: params.q,
  });
  const canCreate = session.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-teal-700 uppercase">
            Administração
          </p>
          <h1 className="mt-1 font-serif text-3xl">Usuários</h1>
          <p className="mt-1 text-sm text-slate-600">
            Contas de acesso ao sistema (analistas, gestores, correspondentes).
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/users/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Novo usuário
          </Link>
        ) : null}
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Buscar por nome ou e-mail"
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
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Último login</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((user) => (
              <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                <td className="px-4 py-3 font-medium">{user.fullName}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">{roleLabel(user.role)}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      user.active
                        ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                    }
                  >
                    {user.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}
                </td>
              </tr>
            ))}
            {data.items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-slate-500" colSpan={5}>
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
