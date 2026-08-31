"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ClientOption = { id: string; fullName: string };

export default function NewProcessPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/v1/clients?pageSize=100")
      .then((r) => r.json())
      .then((json) => {
        setClients(
          (json.data?.items ?? []).map((c: { id: string; fullName: string }) => ({
            id: c.id,
            fullName: c.fullName,
          })),
        );
      })
      .catch(() => setError("Não foi possível carregar clientes"));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      clientId: String(form.get("clientId")),
      incomeProfile: String(form.get("incomeProfile")),
      intendedBank: String(form.get("intendedBank") ?? "") || null,
      institutionalChannel: String(form.get("institutionalChannel") ?? "NENHUM"),
      institutionalSendOptIn: form.get("institutionalSendOptIn") === "on",
      propertyValue: String(form.get("propertyValue") ?? "") || null,
      downPayment: String(form.get("downPayment") ?? "") || null,
      financedAmount: String(form.get("financedAmount") ?? "") || null,
      fgtsAmount: String(form.get("fgtsAmount") ?? "") || null,
      amortizationSystem: String(form.get("amortizationSystem") ?? "") || null,
      financingType: String(form.get("financingType") ?? "") || null,
      hasCreditCard: String(form.get("hasCreditCard") ?? "true") === "true",
    };

    try {
      const response = await fetch("/api/v1/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) {
        const details = Array.isArray(json?.error?.details)
          ? json.error.details
              .map((d: { message?: string }) => d.message)
              .filter(Boolean)
              .join(" · ")
          : null;
        setError(
          details ||
            json?.error?.message ||
            "Erro ao criar processo",
        );
        return;
      }
      router.push(`/processes/${json.data.id}`);
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
        <Link href="/processes" className="text-sm text-teal-800 hover:underline">
          ← Processos
        </Link>
        <h1 className="mt-2 font-serif text-3xl">Novo processo</h1>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <label className="block text-sm">
          Cliente
          <select
            name="clientId"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Selecione...</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.fullName}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          Perfil de renda
          <select
            name="incomeProfile"
            required
            defaultValue="AUTONOMO"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="AUTONOMO">Autônomo</option>
            <option value="CLT">CLT</option>
            <option value="MEI">MEI</option>
            <option value="EMPRESARIO">Empresário</option>
            <option value="SERVIDOR_PUBLICO">Servidor público</option>
            <option value="APOSENTADO">Aposentado</option>
            <option value="PENSIONISTA">Pensionista</option>
            <option value="COMPOSICAO_RENDA">Composição de renda</option>
            <option value="SOCIO_EMPRESA">Sócio de empresa</option>
            <option value="PRODUTOR_RURAL">Produtor rural</option>
          </select>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            Banco pretendido (texto livre, opcional)
            <input name="intendedBank" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            Destino institucional
            <select name="institutionalChannel" defaultValue="NENHUM" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
              <option value="NENHUM">Não enviar a banco</option>
              <option value="CAIXA">Caixa</option>
              <option value="OUTRO">Outro banco</option>
            </select>
          </label>
          <label className="text-sm">
            Sistema
            <select name="amortizationSystem" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
              <option value="">—</option>
              <option value="SAC">SAC</option>
              <option value="PRICE">PRICE</option>
            </select>
          </label>
          <label className="text-sm">
            Valor do imóvel
            <input name="propertyValue" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            Entrada
            <input name="downPayment" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            Valor financiado
            <input name="financedAmount" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            FGTS
            <input name="fgtsAmount" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm md:col-span-2">
            Possui cartão de crédito?
            <select
              name="hasCreditCard"
              defaultValue="true"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="true">Sim (faturas obrigatórias se autônomo)</option>
              <option value="false">Não (faturas = não aplicável)</option>
            </select>
          </label>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="institutionalSendOptIn" className="mt-1" />
          <span>
            Cliente autorizou encaminhamento institucional (só vale se o destino
            não for “Não enviar”)
          </span>
        </label>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Criando..." : "Abrir processo"}
        </button>
      </form>
    </div>
  );
}
