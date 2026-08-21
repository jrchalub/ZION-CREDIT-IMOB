"use client";

import { useCallback, useEffect, useState } from "react";

type FinancingSubmission = {
  id: string;
  institution: string;
  provider: string;
  status: string;
  providerRef: string | null;
  externalStatus: string | null;
  errorMessage: string | null;
  responseSummary: Record<string, unknown> | null;
  submittedAt: string | null;
  lastTrackedAt: string | null;
  createdAt: string;
};

export function ProcessFinancingPanel({
  processId,
  processStatus,
}: {
  processId: string;
  processStatus: string;
}) {
  const [items, setItems] = useState<FinancingSubmission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const canSubmit =
    processStatus === "APTO" || processStatus === "AGUARDANDO_BANCO";

  const reload = useCallback(async () => {
    const res = await fetch(`/api/v1/processes/${processId}/financing`);
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? "Erro ao carregar envios institucionais");
      return;
    }
    setItems(json.data.items);
    setError(null);
  }, [processId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submit() {
    setBusy("submit");
    setError(null);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/financing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institution: "CAIXA" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha no envio institucional");
        return;
      }
      await reload();
      window.location.reload();
    } finally {
      setBusy(null);
    }
  }

  async function track(submissionId: string) {
    setBusy(submissionId);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/processes/${processId}/financing/${submissionId}/track`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha ao atualizar status");
        return;
      }
      await reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-serif text-xl">Envio institucional (FASE 7)</h2>
        <p className="mt-1 text-sm text-slate-600">
          FinancingProvider — mock ou HTTP. Envia metadados do processo (sem
          binários). APROVADO/REPROVADO só com transição humana.
        </p>
      </div>

      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Zion Credit não concede crédito. O retorno institucional é indicativo até
        confirmação humana no status do processo.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy !== null || !canSubmit}
          onClick={() => void submit()}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy === "submit"
            ? "Enviando…"
            : "Enviar à Caixa (mock)"}
        </button>
        {!canSubmit ? (
          <span className="text-xs text-slate-500">
            Disponível quando o processo estiver APTO ou AGUARDANDO_BANCO
            (atual: {processStatus}).
          </span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 py-2"
          >
            <div>
              <p className="font-medium">
                {item.institution} · {item.provider} · {item.status}
              </p>
              <p className="text-xs text-slate-500">
                {item.externalStatus
                  ? `Externo: ${item.externalStatus}`
                  : "Sem status externo"}
                {item.providerRef ? ` · ref ${item.providerRef}` : ""}
              </p>
              {item.errorMessage ? (
                <p className="text-xs text-rose-700">{item.errorMessage}</p>
              ) : null}
              <p className="text-xs text-slate-400">
                {new Date(item.createdAt).toLocaleString("pt-BR")}
                {item.lastTrackedAt
                  ? ` · track ${new Date(item.lastTrackedAt).toLocaleString("pt-BR")}`
                  : ""}
              </p>
            </div>
            {item.providerRef ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void track(item.id)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === item.id ? "…" : "Atualizar status"}
              </button>
            ) : null}
          </li>
        ))}
        {items.length === 0 ? (
          <li className="text-slate-500">Nenhum envio institucional ainda.</li>
        ) : null}
      </ul>
    </section>
  );
}
