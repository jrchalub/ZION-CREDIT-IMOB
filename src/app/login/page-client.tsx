"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("admin@zioncredit.demo");
  const [password, setPassword] = useState("Zion@Demo123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message ?? "Falha no login");
        return;
      }
      const role = payload?.data?.user?.role as string | undefined;
      const next =
        searchParams.get("next") ||
        (role === "CORRESPONDENTE" ? "/dashboard" : "/dashboard");
      router.push(next);
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(20,184,166,0.22),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(14,116,144,0.25),transparent_35%),linear-gradient(160deg,#07131c,#0b2430_45%,#102a32)]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
        <div className="grid w-full gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="max-w-xl">
            <p className="text-xs tracking-[0.25em] text-teal-300 uppercase">
              ZION CREDIT
            </p>
            <h1 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">
              Análise documental e pré-crédito imobiliário
            </h1>
            <p className="mt-4 text-base text-slate-300">
              Coleta, organização, evidências e apoio à decisão do analista —
              sem decisão bancária automática.
            </p>
          </section>

          <form
            onSubmit={onSubmit}
            className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur"
          >
            <h2 className="font-serif text-2xl">Acesso</h2>
            <p className="mt-1 text-sm text-slate-300">
              Ambiente demo — use as credenciais seed.
            </p>
            <label className="mt-6 block text-sm text-slate-200">
              E-mail
              <input
                className="mt-1 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 py-2 text-white outline-none focus:border-teal-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
            </label>
            <label className="mt-4 block text-sm text-slate-200">
              Senha
              <input
                className="mt-1 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 py-2 text-white outline-none focus:border-teal-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
              />
            </label>
            {error ? (
              <p className="mt-3 text-sm text-rose-300" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-md bg-teal-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
