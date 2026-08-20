"use client";

import { useCallback, useEffect, useState } from "react";

type IntegrationCall = {
  id: string;
  kind: string;
  provider: string;
  status: string;
  responseSummary: Record<string, unknown> | null;
  providerRef: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export function ProcessIntegrationsPanel({ processId }: { processId: string }) {
  const [items, setItems] = useState<IntegrationCall[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/v1/processes/${processId}/integrations`);
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? "Erro ao carregar integrações");
      return;
    }
    setItems(json.data.items);
    setError(null);
  }, [processId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function run(kind: "BUREAU" | "BANK_READ") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha na consulta");
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
        <h2 className="font-serif text-xl">Integrações (leitura)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Bureau / leitura bancária via IntegrationProvider — mock ou HTTP.
          Envio institucional = FASE 7.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void run("BUREAU")}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy === "BUREAU" ? "Consultando…" : "Consultar bureau (mock)"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void run("BANK_READ")}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === "BANK_READ" ? "Consultando…" : "Leitura bancária (mock)"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <ul className="space-y-2 text-sm">
        {items.slice(0, 8).map((item) => (
          <li
            key={item.id}
            className="rounded-md border border-slate-100 px-3 py-2"
          >
            <p className="font-medium">
              {item.kind} · {item.provider}{" "}
              <span className="text-xs font-normal text-slate-500">
                ({item.status})
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {new Date(item.createdAt).toLocaleString("pt-BR")}
              {item.providerRef ? ` · ref ${item.providerRef}` : ""}
            </p>
            {item.responseSummary ? (
              <p className="mt-1 text-slate-600">
                {String(
                  item.responseSummary.indicative ??
                    item.responseSummary.openFinanceStatus ??
                    item.responseSummary.notes ??
                    JSON.stringify(item.responseSummary).slice(0, 120),
                )}
              </p>
            ) : null}
            {item.errorMessage ? (
              <p className="mt-1 text-xs text-amber-800">{item.errorMessage}</p>
            ) : null}
          </li>
        ))}
        {items.length === 0 ? (
          <li className="text-slate-500">Nenhuma consulta registrada.</li>
        ) : null}
      </ul>
    </section>
  );
}
