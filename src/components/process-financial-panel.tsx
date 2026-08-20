"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";

type FinancialPayload = {
  analysis: {
    id: string;
    status: string;
    indicative: string | null;
    disclaimer: string;
    summary: Record<string, unknown> | null;
    finishedAt: string | null;
  } | null;
  income: {
    declaredIncome: string | null;
    estimatedIncome: string | null;
    meanIncome: string | null;
    medianIncome: string | null;
    confidence: string | null;
    monthsAnalyzed: number;
    exclusions: Array<{ category: string; amount: number; month?: string }>;
  } | null;
  months: Array<{
    yearMonth: string;
    grossCredits: string;
    ownTransfers: string;
    loans: string;
    refunds: string;
    validCredits: string;
  }>;
  cards: Array<{
    issuer: string | null;
    monthlyCommitment: string | null;
    invoiceAmount: string | null;
  }>;
  debts: Array<{
    id: string;
    type: string;
    creditor: string | null;
    monthlyInstallment: string | null;
  }>;
  commitments: {
    rent: string;
    debtsTotal: string;
    cardsTotal: string;
    otherCommitments: string;
    totalCommitments: string;
  } | null;
  simulation: {
    amortizationSystem: string;
    financedAmount: string;
    firstInstallment: string | null;
    averageInstallment: string | null;
    termMonths: number;
    annualRatePct: string;
  } | null;
  capacity: {
    commitmentPct: string | null;
    estimatedCapacity: string | null;
    simulatedInstallment: string | null;
    indicative: string;
    flags: string[];
  } | null;
  immutableSnapshot: {
    ruleVersion: string;
    contentHash: string;
    payload: Record<string, unknown>;
  } | null;
  disclaimer: string;
};

const INDICATIVE_LABEL: Record<string, string> = {
  FAVORAVEL: "Favorável (pré-análise)",
  NECESSITA_ANALISE: "Necessita análise",
  DESFAVORAVEL: "Desfavorável (pré-análise)",
};

export function ProcessFinancialPanel({ processId }: { processId: string }) {
  const [data, setData] = useState<FinancialPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rent, setRent] = useState("0");
  const [debtType, setDebtType] = useState("EMPRESTIMO");
  const [debtInstallment, setDebtInstallment] = useState("");
  const [debtCreditor, setDebtCreditor] = useState("");

  const reload = useCallback(async () => {
    const res = await fetch(`/api/v1/processes/${processId}/financial-analysis`);
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? "Erro ao carregar análise");
      return;
    }
    setData(json.data);
  }, [processId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function runAnalysis() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/financial-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "sync",
          rent: Number(rent) || 0,
          simulationOverride: {
            termMonths: 360,
            annualRatePct: 9.5,
            amortizationSystem: "PRICE",
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha na análise financeira");
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function addDebt() {
    if (!debtInstallment) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/debts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: debtType,
          creditor: debtCreditor || null,
          monthlyInstallment: debtInstallment,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha ao incluir dívida");
        return;
      }
      setDebtInstallment("");
      setDebtCreditor("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl">Pré-análise financeira</h2>
          <p className="mt-1 text-sm text-slate-600">
            Motor FASE 4 — créditos válidos, média/mediana, compromissos e simulação.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">
            Aluguel
            <input
              value={rent}
              onChange={(e) => setRent(e.target.value)}
              className="mt-1 block w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runAnalysis()}
            className="rounded-md bg-teal-800 px-3 py-2 text-sm text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {busy ? "Analisando…" : "Rodar análise"}
          </button>
        </div>
      </div>

      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {data?.disclaimer ??
          "Resultado de pré-análise interna. Não representa aprovação ou reprovação de crédito por instituição financeira."}
      </p>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      {data?.immutableSnapshot ? (
        <p className="font-mono text-xs text-slate-500">
          SNAPSHOT imutável · RULE_VERSION=
          {String(
            (data.immutableSnapshot as { ruleVersion?: string }).ruleVersion ??
              "rules-v1",
          )}{" "}
          · hash{" "}
          {String(
            (data.immutableSnapshot as { contentHash?: string }).contentHash ?? "",
          ).slice(0, 16)}
          …
        </p>
      ) : null}

      {!data?.analysis ? (
        <p className="text-sm text-slate-500">
          Nenhuma análise ainda. Rode a análise após extratos processados na FASE 3.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Renda declarada"
              value={formatCurrency(data.income?.declaredIncome)}
            />
            <Metric
              label="Renda analisada (mediana)"
              value={formatCurrency(data.income?.estimatedIncome)}
            />
            <Metric
              label="Parcela simulada"
              value={formatCurrency(data.capacity?.simulatedInstallment)}
            />
            <Metric
              label="Comprometimento"
              value={
                data.capacity?.commitmentPct
                  ? `${Number(data.capacity.commitmentPct).toFixed(1)}%`
                  : "—"
              }
            />
          </div>

          <div className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs tracking-wide text-slate-500 uppercase">
              Indicativo interno
            </p>
            <p className="font-serif text-2xl">
              {data.analysis.indicative
                ? INDICATIVE_LABEL[data.analysis.indicative] ?? data.analysis.indicative
                : "—"}
            </p>
            {data.capacity?.flags?.length ? (
              <p className="mt-1 text-xs text-slate-600">
                Flags: {data.capacity.flags.join(", ")}
              </p>
            ) : null}
          </div>

          {data.months.length > 0 ? (
            <div>
              <h3 className="font-medium text-sm">Créditos por mês</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="py-1 pr-3">Mês</th>
                      <th className="py-1 pr-3">Brutos</th>
                      <th className="py-1 pr-3">Próprias</th>
                      <th className="py-1 pr-3">Empréstimos</th>
                      <th className="py-1 pr-3">Estornos</th>
                      <th className="py-1">Válidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.months.map((m) => (
                      <tr key={m.yearMonth} className="border-t border-slate-100">
                        <td className="py-1.5 pr-3 font-mono text-xs">{m.yearMonth}</td>
                        <td className="py-1.5 pr-3">{formatCurrency(m.grossCredits)}</td>
                        <td className="py-1.5 pr-3">{formatCurrency(m.ownTransfers)}</td>
                        <td className="py-1.5 pr-3">{formatCurrency(m.loans)}</td>
                        <td className="py-1.5 pr-3">{formatCurrency(m.refunds)}</td>
                        <td className="py-1.5 font-medium">
                          {formatCurrency(m.validCredits)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.income ? (
                <p className="mt-2 text-xs text-slate-600">
                  Média {formatCurrency(data.income.meanIncome)} · Mediana{" "}
                  {formatCurrency(data.income.medianIncome)} · Confiança{" "}
                  {data.income.confidence
                    ? `${(Number(data.income.confidence) * 100).toFixed(0)}%`
                    : "—"}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="font-medium text-sm">Compromissos</h3>
              <ul className="mt-2 space-y-1 text-sm">
                <li>Dívidas: {formatCurrency(data.commitments?.debtsTotal)}</li>
                <li>Cartões: {formatCurrency(data.commitments?.cardsTotal)}</li>
                <li>Aluguel: {formatCurrency(data.commitments?.rent)}</li>
                <li>Outros: {formatCurrency(data.commitments?.otherCommitments)}</li>
                <li className="font-medium">
                  Total: {formatCurrency(data.commitments?.totalCommitments)}
                </li>
                <li>
                  Capacidade estimada:{" "}
                  {formatCurrency(data.capacity?.estimatedCapacity)}
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-sm">Simulação</h3>
              {data.simulation ? (
                <ul className="mt-2 space-y-1 text-sm">
                  <li>Sistema: {data.simulation.amortizationSystem}</li>
                  <li>Prazo: {data.simulation.termMonths} meses</li>
                  <li>Taxa a.a.: {data.simulation.annualRatePct}%</li>
                  <li>
                    Financiado: {formatCurrency(data.simulation.financedAmount)}
                  </li>
                  <li>
                    1ª parcela: {formatCurrency(data.simulation.firstInstallment)}
                  </li>
                  <li>
                    Parcela média:{" "}
                    {formatCurrency(data.simulation.averageInstallment)}
                  </li>
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Informe valor do imóvel/entrada no processo para simular.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {data ? (
          <div>
            <h3 className="font-medium text-sm">Dívidas informadas</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {data.debts.map((d) => (
                <li key={d.id}>
                  {d.type}
                  {d.creditor ? ` · ${d.creditor}` : ""} —{" "}
                  {formatCurrency(d.monthlyInstallment)}/mês
                </li>
              ))}
              {data.debts.length === 0 ? (
                <li className="text-slate-500">Nenhuma dívida cadastrada.</li>
              ) : null}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={debtType}
                onChange={(e) => setDebtType(e.target.value)}
                placeholder="Tipo"
                className="w-36 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                value={debtCreditor}
                onChange={(e) => setDebtCreditor(e.target.value)}
                placeholder="Credor"
                className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                value={debtInstallment}
                onChange={(e) => setDebtInstallment(e.target.value)}
                placeholder="Parcela mensal"
                className="w-36 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void addDebt()}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Incluir dívida
              </button>
            </div>
          </div>
      ) : null}
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
