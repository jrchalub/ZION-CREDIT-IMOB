"use client";

import { useCallback, useEffect, useState } from "react";

type BankingCorrespondent = {
  id: string;
  name: string;
  document: string | null;
  status: string;
};

type FinancingSubmission = {
  id: string;
  submissionLabel: string;
  institution: string;
  provider: string;
  status: string;
  providerRef: string | null;
  externalStatus: string | null;
  errorMessage: string | null;
  bankingCorrespondentId: string | null;
  bankingCorrespondentName: string | null;
  submittedByName: string | null;
  submittedAt: string | null;
  lastTrackedAt: string | null;
  createdAt: string;
  events: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    externalStatus: string | null;
    note: string | null;
    createdAt: string;
  }>;
};

export function ProcessFinancingPanel({
  processId,
  processStatus,
  processNumber,
}: {
  processId: string;
  processStatus: string;
  processNumber: string;
}) {
  const [items, setItems] = useState<FinancingSubmission[]>([]);
  const [partners, setPartners] = useState<BankingCorrespondent[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const canSubmit =
    processStatus === "APTO" ||
    processStatus === "AGUARDANDO_BANCO" ||
    processStatus === "ENVIADO_AO_BANCO";

  const reload = useCallback(async () => {
    const res = await fetch(`/api/v1/processes/${processId}/financing`);
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? "Erro ao carregar envios institucionais");
      return;
    }
    setItems(json.data.items);
    setPartners(json.data.bankingCorrespondents ?? []);
    setError(null);
  }, [processId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submit() {
    if (!selectedPartnerId) {
      setError("Selecione o correspondente bancário antes de enviar.");
      return;
    }
    setBusy("submit");
    setError(null);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/financing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institution: "CAIXA",
          bankingCorrespondentId: selectedPartnerId,
        }),
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
          Escolha o correspondente bancário antes de enviar. Cada envio gera uma
          submissão histórica independente.
        </p>
      </div>

      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Zion Credit não concede crédito. O retorno institucional é indicativo até
        confirmação humana no status do processo.
      </p>

      <div className="space-y-3">
        <label className="block text-sm">
          Correspondente bancário
          <select
            className="mt-1 w-full max-w-md rounded-md border border-slate-300 px-3 py-2"
            value={selectedPartnerId}
            disabled={!canSubmit || busy !== null}
            onChange={(e) => setSelectedPartnerId(e.target.value)}
          >
            <option value="">Selecione…</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy !== null || !canSubmit}
            onClick={() => void submit()}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy === "submit" ? "Enviando…" : "Enviar à Caixa (mock)"}
          </button>
          {!canSubmit ? (
            <span className="text-xs text-slate-500">
              Disponível em APTO, AGUARDANDO_BANCO ou ENVIADO_AO_BANCO (atual:{" "}
              {processStatus}).
            </span>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <ul className="space-y-3 text-sm">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-md border border-slate-100 px-3 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs text-slate-400">
                  {processNumber} · {item.submissionLabel}
                </p>
                <p className="font-medium">
                  Enviado à {item.institution}
                  {item.bankingCorrespondentName
                    ? ` · Correspondente: ${item.bankingCorrespondentName}`
                    : ""}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(item.submittedAt ?? item.createdAt).toLocaleString(
                    "pt-BR",
                  )}
                  {item.submittedByName
                    ? ` · Usuário: ${item.submittedByName}`
                    : ""}
                </p>
                <p className="text-xs text-slate-500">
                  Status: {item.status}
                  {item.externalStatus ? ` · Externo: ${item.externalStatus}` : ""}
                  {item.providerRef ? ` · ref ${item.providerRef}` : ""}
                </p>
                {item.events.length > 0 ? (
                  <ul className="mt-2 space-y-1 border-t border-slate-50 pt-2 text-xs text-slate-500">
                    {item.events.map((event) => (
                      <li key={event.id}>
                        {new Date(event.createdAt).toLocaleString("pt-BR")} ·{" "}
                        {event.fromStatus ? `${event.fromStatus} → ` : ""}
                        {event.toStatus}
                        {event.note ? ` · ${event.note}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {item.errorMessage ? (
                  <p className="text-xs text-rose-700">{item.errorMessage}</p>
                ) : null}
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
            </div>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="text-slate-500">Nenhum envio institucional ainda.</li>
        ) : null}
      </ul>
    </section>
  );
}
