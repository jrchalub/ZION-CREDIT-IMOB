"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewClientPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    const payload = {
      fullName: String(form.get("fullName") ?? ""),
      cpf: String(form.get("cpf") ?? ""),
      profession: String(form.get("profession") ?? "") || null,
      occupationType: String(form.get("occupationType") ?? "") || null,
      phone: String(form.get("phone") ?? "") || null,
      whatsapp: String(form.get("whatsapp") ?? "") || null,
      email: String(form.get("email") ?? "") || null,
      declaredIncome: String(form.get("declaredIncome") ?? "") || null,
      primaryBank: String(form.get("primaryBank") ?? "") || null,
      address: {
        street: String(form.get("street") ?? ""),
        number: String(form.get("number") ?? "") || null,
        neighborhood: String(form.get("neighborhood") ?? "") || null,
        city: String(form.get("city") ?? ""),
        state: String(form.get("state") ?? ""),
        zipCode: String(form.get("zipCode") ?? ""),
      },
    };

    try {
      const response = await fetch("/api/v1/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json?.error?.message ?? "Erro ao criar cliente");
        return;
      }
      router.push(`/clients/${json.data.id}`);
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
        <Link href="/clients" className="text-sm text-teal-800 hover:underline">
          ← Clientes
        </Link>
        <h1 className="mt-2 font-serif text-3xl">Novo cliente</h1>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            Nome completo
            <input name="fullName" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            CPF
            <input name="cpf" required placeholder="000.000.000-00" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            Profissão
            <input name="profession" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            Tipo de ocupação
            <input name="occupationType" placeholder="AUTONOMO / CLT..." className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            Renda declarada
            <input name="declaredIncome" placeholder="2550.00" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            Telefone
            <input name="phone" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            WhatsApp
            <input name="whatsapp" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm md:col-span-2">
            E-mail
            <input name="email" type="email" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            Banco principal
            <input name="primaryBank" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            CEP
            <input name="zipCode" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm md:col-span-2">
            Rua
            <input name="street" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            Número
            <input name="number" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            Bairro
            <input name="neighborhood" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            Cidade
            <input name="city" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            UF
            <input name="state" required maxLength={2} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 uppercase" />
          </label>
        </div>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Salvar cliente"}
        </button>
      </form>
    </div>
  );
}
