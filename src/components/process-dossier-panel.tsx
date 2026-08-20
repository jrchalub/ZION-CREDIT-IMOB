"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";

type Summary = {
  identification?: { clientName: string; processNumber: string };
  decisionSupport: {
    indicativeResult: string;
    rulesVersion: string;
    contentHash: string;
  } | null;
  income: { declared: string | null; analyzed: string | number | null };
  capacity: { commitmentPct: string | number | null; estimated: string | number | null };
  documentation: { percentComplete: number };
  consistency: { score: number | null };
  pendencies: { openCount: number };
  factors: {
    positive: Array<{ label?: string; description: string }>;
    attention: Array<{ description: string }>;
  };
  disclaimer: string;
};

const INDICATIVE: Record<string, string> = {
  FAVORAVEL: "Favorável (pré-análise)",
  REQUER_ANALISE: "Requer análise",
  DESFAVORAVEL: "Desfavorável (pré-análise)",
};

export function ProcessDossierPanel({ processId }: { processId: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/v1/processes/${processId}/dossier`);
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? "Erro ao carregar dossiê");
      return;
    }
    setData(json.data);
  }, [processId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/dossier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha ao gerar");
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl">Análise do processo</h2>
        <p className="mt-2 text-sm text-slate-500">{error ?? "Carregando…"}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl">Análise do processo</h2>
          <p className="mt-1 text-sm text-slate-600">
            Credit Decision Support — sem score-caixa-preta
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void generate()}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Gerar dossiê
          </button>
          <Link
            href={`/processes/${processId}/dossier`}
            className="rounded-md bg-teal-800 px-3 py-2 text-sm text-white hover:bg-teal-700"
          >
            Ver dossiê
          </Link>
        </div>
      </div>

      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {data.disclaimer}
      </p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Renda declarada" value={formatCurrency(data.income.declared)} />
        <Metric
          label="Renda analisada"
          value={formatCurrency(String(data.income.analyzed ?? ""))}
        />
        <Metric
          label="Comprometimento"
          value={
            data.capacity.commitmentPct != null
              ? `${Number(data.capacity.commitmentPct)}%`
              : "—"
          }
        />
        <Metric
          label="Capacidade"
          value={formatCurrency(String(data.capacity.estimated ?? ""))}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Documentação" value={`${data.documentation.percentComplete}%`} />
        <Metric
          label="Consistência"
          value={data.consistency.score != null ? `${data.consistency.score}` : "—"}
        />
        <Metric label="Pendências" value={String(data.pendencies.openCount)} />
      </div>

      <div className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-xs tracking-wide text-slate-500 uppercase">Indicativo</p>
        <p className="font-serif text-2xl">
          {data.decisionSupport
            ? INDICATIVE[data.decisionSupport.indicativeResult] ??
              data.decisionSupport.indicativeResult
            : "Gere o dossiê para obter o indicativo"}
        </p>
        {data.decisionSupport ? (
          <p className="mt-1 font-mono text-xs text-slate-500">
            {data.decisionSupport.rulesVersion} · hash{" "}
            {data.decisionSupport.contentHash.slice(0, 12)}…
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">Fatores positivos</h3>
          <ul className="mt-2 space-y-1 text-sm text-emerald-800">
            {data.factors.positive.slice(0, 5).map((f) => (
              <li key={f.description}>✓ {f.description}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium">Pontos de atenção</h3>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {data.factors.attention.slice(0, 5).map((f) => (
              <li key={f.description}>⚠ {f.description}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-100 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-serif text-xl">{value}</p>
    </div>
  );
}
