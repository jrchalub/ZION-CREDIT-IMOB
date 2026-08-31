"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const INCOME_PROFILES = [
  { value: "AUTONOMO", label: "Autônomo" },
  { value: "CLT", label: "CLT" },
  { value: "MEI", label: "MEI" },
  { value: "EMPRESARIO", label: "Empresário" },
  { value: "SERVIDOR_PUBLICO", label: "Servidor público" },
  { value: "APOSENTADO", label: "Aposentado" },
  { value: "PENSIONISTA", label: "Pensionista" },
  { value: "COMPOSICAO_RENDA", label: "Composição de renda" },
  { value: "SOCIO_EMPRESA", label: "Sócio de empresa" },
  { value: "PRODUTOR_RURAL", label: "Produtor rural" },
] as const;

type ProcessEditData = {
  id: string;
  processNumber: string;
  clientName: string;
  incomeProfile: string;
  intendedBank: string | null;
  institutionalChannel: string;
  institutionalSendOptIn: boolean;
  propertyValue: string | null;
  downPayment: string | null;
  financedAmount: string | null;
  fgtsAmount: string | null;
  amortizationSystem: string | null;
  financingType: string | null;
};

export function ProcessEditForm({ process }: { process: ProcessEditData }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload = {
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
    };

    try {
      const response = await fetch(`/api/v1/processes/${process.id}`, {
        method: "PATCH",
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
        setError(details || json?.error?.message || "Erro ao salvar");
        return;
      }
      router.push(`/processes/${process.id}`);
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
        <Link
          href={`/processes/${process.id}`}
          className="text-sm text-teal-800 hover:underline"
        >
          ← Voltar ao processo
        </Link>
        <h1 className="mt-2 font-serif text-3xl">Editar processo</h1>
        <p className="mt-1 font-mono text-sm text-slate-500">
          {process.processNumber} · {process.clientName}
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <label className="block text-sm">
          Perfil de renda
          <select
            name="incomeProfile"
            required
            defaultValue={process.incomeProfile}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          >
            {INCOME_PROFILES.map((profile) => (
              <option key={profile.value} value={profile.value}>
                {profile.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            Banco pretendido (texto livre)
            <input
              name="intendedBank"
              defaultValue={process.intendedBank ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Destino institucional
            <select
              name="institutionalChannel"
              defaultValue={process.institutionalChannel}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="NENHUM">Não enviar a banco</option>
              <option value="CAIXA">Caixa</option>
              <option value="OUTRO">Outro banco</option>
            </select>
          </label>
          <label className="text-sm">
            Sistema
            <select
              name="amortizationSystem"
              defaultValue={process.amortizationSystem ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">—</option>
              <option value="SAC">SAC</option>
              <option value="PRICE">PRICE</option>
            </select>
          </label>
          <label className="text-sm">
            Tipo de financiamento
            <input
              name="financingType"
              defaultValue={process.financingType ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Valor do imóvel
            <input
              name="propertyValue"
              defaultValue={process.propertyValue ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Entrada
            <input
              name="downPayment"
              defaultValue={process.downPayment ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Valor financiado
            <input
              name="financedAmount"
              defaultValue={process.financedAmount ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            FGTS
            <input
              name="fgtsAmount"
              defaultValue={process.fgtsAmount ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="institutionalSendOptIn"
            defaultChecked={process.institutionalSendOptIn}
            className="mt-1"
          />
          <span>Cliente autorizou encaminhamento institucional</span>
        </label>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "Salvando…" : "Salvar alterações"}
          </button>
          <Link
            href={`/processes/${process.id}`}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Desistir
          </Link>
        </div>
      </form>
    </div>
  );
}
