"use client";

import { useCallback, useEffect, useState } from "react";

type OperationalView = {
  statusLabel: string;
  operationalStageLabel: string;
  analysisStatus: string;
  documentation: {
    percentComplete: number;
    pending: number;
    validated: number;
    totalApplicable: number;
  };
  pendencies: Array<{
    id: string;
    type: string;
    description: string;
    priority: string;
    status: string;
    dueAt: string | null;
  }>;
  sla: {
    documentationHours: number | null;
    analysisHours: number | null;
    reviewHours: number | null;
    totalHours: number | null;
  } | null;
  disclaimer: string;
};

export function ProcessOperationalPanel({
  processId,
  canRespondPendencies,
}: {
  processId: string;
  canRespondPendencies?: boolean;
}) {
  const [data, setData] = useState<OperationalView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/v1/processes/${processId}/operational`);
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? "Erro ao carregar visão operacional");
      return;
    }
    setData(json.data);
    setError(null);
  }, [processId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function acknowledge(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/v1/pendencies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SUBMITTED" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha ao responder pendência");
        return;
      }
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  if (!data) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl">Status operacional</h2>
        <p className="mt-2 text-sm text-slate-500">{error ?? "Carregando…"}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-serif text-xl">Status operacional</h2>
        <p className="mt-1 text-sm text-slate-600">
          {data.operationalStageLabel} · {data.statusLabel}
        </p>
        <p className="mt-2 text-sm font-medium text-slate-800">
          {data.analysisStatus}
        </p>
      </div>

      <div>
        <p className="text-xs tracking-wide text-slate-500 uppercase">
          Documentação
        </p>
        <div className="mt-2 h-2 rounded bg-slate-100">
          <div
            className="h-2 rounded bg-teal-600"
            style={{ width: `${Math.max(4, data.documentation.percentComplete)}%` }}
          />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {data.documentation.percentComplete}% ·{" "}
          {data.documentation.validated} validados ·{" "}
          {data.documentation.pending} pendentes
        </p>
      </div>

      {data.sla ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">SLA documentação</dt>
            <dd>{data.sla.documentationHours ?? "—"} h</dd>
          </div>
          <div>
            <dt className="text-slate-500">SLA análise</dt>
            <dd>{data.sla.analysisHours ?? "—"} h</dd>
          </div>
          <div>
            <dt className="text-slate-500">SLA parecer</dt>
            <dd>{data.sla.reviewHours ?? "—"} h</dd>
          </div>
          <div>
            <dt className="text-slate-500">SLA total</dt>
            <dd>{data.sla.totalHours ?? "—"} h</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-slate-500">SLA ainda não iniciado.</p>
      )}

      <div>
        <h3 className="font-medium text-slate-900">Pendências abertas</h3>
        {data.pendencies.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Nenhuma pendência aberta.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {data.pendencies.map((p) => (
              <li
                key={p.id}
                className="rounded-md border border-slate-100 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {p.type}{" "}
                      <span className="text-xs font-normal text-slate-500">
                        ({p.priority} · {p.status})
                      </span>
                    </p>
                    <p className="mt-1 text-slate-600">{p.description}</p>
                  </div>
                  {canRespondPendencies &&
                  (p.status === "OPEN" || p.status === "REJECTED") ? (
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => void acknowledge(p.id)}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {busyId === p.id ? "…" : "Marcar enviada"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <p className="text-xs text-slate-500">{data.disclaimer}</p>
    </section>
  );
}
