"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type FormOptions = {
  roles: Array<{ value: string; label: string }>;
  correspondents: Array<{ id: string; companyName: string; active: boolean }>;
};

export default function NewUserPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<FormOptions | null>(null);
  const [role, setRole] = useState("ANALISTA");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/v1/users/form-options");
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Erro ao carregar formulário");
        return;
      }
      setOptions(json.data);
    })();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    const payload = {
      fullName: String(form.get("fullName") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      role: String(form.get("role") ?? "ANALISTA"),
      phone: String(form.get("phone") ?? "") || null,
      correspondentId:
        role === "CORRESPONDENTE"
          ? String(form.get("correspondentId") ?? "") || null
          : null,
    };

    try {
      const response = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) {
        const detail = json?.error?.details?.[0]?.message;
        setError(detail ?? json?.error?.message ?? "Erro ao criar usuário");
        return;
      }
      router.push("/users");
      router.refresh();
    } catch {
      setError("Falha de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/users" className="text-sm text-teal-800 hover:underline">
          ← Usuários
        </Link>
        <h1 className="mt-2 font-serif text-3xl">Novo usuário</h1>
        <p className="mt-1 text-sm text-slate-600">
          Crie uma conta com e-mail e senha. O usuário acessa pelo mesmo login do sistema.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            Nome completo
            <input
              name="fullName"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            E-mail
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Telefone
            <input name="phone" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            Senha
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Perfil
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {options?.roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              )) ?? (
                <>
                  <option value="ANALISTA">Analista</option>
                  <option value="GESTOR">Gestor</option>
                  <option value="OPERADOR">Operador</option>
                  <option value="CORRESPONDENTE">Correspondente</option>
                  <option value="ADMIN">Administrador</option>
                </>
              )}
            </select>
          </label>
          {role === "CORRESPONDENTE" ? (
            <label className="text-sm md:col-span-2">
              Organização correspondente
              <select
                name="correspondentId"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">Selecione…</option>
                {options?.correspondents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
              {options && options.correspondents.length === 0 ? (
                <span className="mt-1 block text-xs text-amber-700">
                  Nenhuma organização correspondente cadastrada. Cadastre uma antes de criar este perfil.
                </span>
              ) : null}
            </label>
          ) : null}
        </div>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Criar usuário"}
        </button>
      </form>
    </div>
  );
}
