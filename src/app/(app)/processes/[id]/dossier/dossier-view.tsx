"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatCurrency, formatCpfDisplay } from "@/lib/utils";

type Factor = {
  id?: string;
  kind: string;
  code: string;
  description: string;
  severity: string;
  category: string;
  originType: string;
  originId: string | null;
  originLabel: string | null;
  evidence: Record<string, unknown>;
};

type Dossier = {
  identification: {
    processNumber: string;
    processId: string;
    status: string;
    clientName: string;
    clientCpf: string;
    intendedBank: string | null;
  };
  professionalProfile: {
    incomeProfile: string;
    profession: string | null;
    occupationType: string | null;
  };
  documentation: {
    percentComplete: number;
    checklist: Array<{ label: string; status: string; requirement: string }>;
    documents: Array<{
      id: string;
      originalFilename: string;
      status: string;
      documentTypeCode: string;
    }>;
  };
  income: {
    declared: string | null;
    analyzed: string | number | null;
    mean: string | number | null;
    median: string | number | null;
    method: string;
    financialSnapshotId: string | null;
    ruleVersion: string | null;
    months: Array<{
      yearMonth: string;
      validCredits: string;
      grossCredits: string;
    }>;
  };
  cards: Array<{ issuer: string | null; monthlyCommitment: string | null }>;
  debts: Array<{
    type: string;
    monthlyInstallment: string | null;
    creditor: string | null;
  }>;
  capacity: {
    estimated: string | number | null;
    commitmentPct: string | number | null;
    indicative: string | null;
  };
  simulation: Record<string, unknown>;
  consistency: {
    score: number | null;
    issues: Array<{ type: string; message: string }>;
  };
  pendencies: {
    openCount: number;
    items: Array<{ id: string; description: string; type: string }>;
  };
  factors: {
    positive: Factor[];
    attention: Factor[];
    pendencies: Factor[];
    all: Factor[];
  };
  matrix: Array<{ category: string; result: string; label: string }>;
  evidence: Array<{
    field: string;
    value: string | null;
    page: number | null;
    evidenceText: string | null;
    documentId: string;
  }>;
  decisionSupport: {
    id: string;
    rulesVersion: string;
    indicativeResult: string;
    contentHash: string;
    financialSnapshotId: string | null;
  } | null;
  review: {
    id: string;
    status: string;
    decision: string | null;
    justification: string | null;
  } | null;
  history: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    createdAt: string;
  }>;
  audit: Array<{ id: string; action: string; createdAt: string }>;
  disclaimer: string;
};

const INDICATIVE: Record<string, string> = {
  FAVORAVEL: "Favorável (pré-análise)",
  REQUER_ANALISE: "Requer análise humana",
  DESFAVORAVEL: "Desfavorável (pré-análise)",
  NECESSITA_ANALISE: "Requer análise humana",
};

const MATRIX_ICON: Record<string, string> = {
  OK: "OK",
  ATENCAO: "Atenção",
  CRITICO: "Crítico",
  NA: "—",
};

export function ProcessDossierView({ processId }: { processId: string }) {
  const [data, setData] = useState<Dossier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [justification, setJustification] = useState("");

  const reload = useCallback(async () => {
    const res = await fetch(`/api/v1/processes/${processId}/dossier`);
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? "Erro ao carregar dossiê");
      return;
    }
    setData(json.data);
    setError(null);
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
        setError(json?.error?.message ?? "Falha ao gerar dossiê");
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function startReview() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/analyst-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha ao iniciar revisão");
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "APPROVED" | "REJECTED" | "RETURNED") {
    if (justification.trim().length < 10) {
      setError("Justificativa obrigatória (mín. 10 caracteres)");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/analyst-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "decide",
          decision,
          justification,
          reviewId: data?.review?.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha ao registrar parecer");
        return;
      }
      setJustification("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <p className="text-sm text-slate-600">{error ?? "Carregando dossiê…"}</p>;
  }

  const indicative =
    data.decisionSupport?.indicativeResult ?? data.capacity.indicative;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/processes/${processId}`}
            className="text-sm text-teal-800 hover:underline"
          >
            ← Voltar ao processo
          </Link>
          <h1 className="mt-2 font-serif text-3xl">Dossiê de crédito</h1>
          <p className="mt-1 text-sm text-slate-600">
            {data.identification.clientName} · {data.identification.processNumber}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void generate()}
            className="rounded-md bg-teal-800 px-3 py-2 text-sm text-white hover:bg-teal-700 disabled:opacity-60"
          >
            Gerar / atualizar dossiê
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void startReview()}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Analisar
          </button>
        </div>
      </div>

      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {data.disclaimer}
      </p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs tracking-wide text-slate-500 uppercase">Indicativo</p>
        <p className="font-serif text-3xl">
          {indicative ? INDICATIVE[indicative] ?? indicative : "Gere o dossiê"}
        </p>
        {data.decisionSupport ? (
          <p className="mt-2 font-mono text-xs text-slate-500">
            rules_version={data.decisionSupport.rulesVersion} · snapshot{" "}
            {data.decisionSupport.id.slice(0, 8)} · financial=
            {data.decisionSupport.financialSnapshotId?.slice(0, 8) ?? "—"} · hash{" "}
            {data.decisionSupport.contentHash.slice(0, 12)}…
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="1. Identificação">
          <ul className="space-y-1 text-sm">
            <li>Cliente: {data.identification.clientName}</li>
            <li>CPF: {formatCpfDisplay(data.identification.clientCpf)}</li>
            <li>Status: {data.identification.status}</li>
            <li>Banco: {data.identification.intendedBank ?? "—"}</li>
          </ul>
        </Section>
        <Section title="2. Perfil profissional">
          <ul className="space-y-1 text-sm">
            <li>Perfil: {data.professionalProfile.incomeProfile}</li>
            <li>Profissão: {data.professionalProfile.profession ?? "—"}</li>
            <li>Ocupação: {data.professionalProfile.occupationType ?? "—"}</li>
          </ul>
        </Section>
      </div>

      <Section title="3. Documentação">
        <p className="text-sm">Completude: {data.documentation.percentComplete}%</p>
        <ul className="mt-2 space-y-1 text-sm">
          {data.documentation.checklist.map((c) => (
            <li key={c.label}>
              {c.label} — {c.status} ({c.requirement})
            </li>
          ))}
        </ul>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="4. Renda">
          <ul className="space-y-1 text-sm">
            <li>Declarada: {formatCurrency(data.income.declared)}</li>
            <li>Analisada: {formatCurrency(String(data.income.analyzed ?? ""))}</li>
            <li>Método: {data.income.method}</li>
            <li>Média: {formatCurrency(String(data.income.mean ?? ""))}</li>
            <li>Mediana: {formatCurrency(String(data.income.median ?? ""))}</li>
          </ul>
        </Section>
        <Section title="5. Movimentação bancária">
          <ul className="space-y-1 text-sm">
            {data.income.months.map((m) => (
              <li key={m.yearMonth}>
                {m.yearMonth}: válidos {formatCurrency(m.validCredits)}
              </li>
            ))}
            {data.income.months.length === 0 ? (
              <li className="text-slate-500">Sem rolls mensais.</li>
            ) : null}
          </ul>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="6. Cartões">
          <ul className="space-y-1 text-sm">
            {data.cards.map((c, i) => (
              <li key={i}>
                {c.issuer ?? "Cartão"}: {formatCurrency(c.monthlyCommitment)}
              </li>
            ))}
            {data.cards.length === 0 ? <li className="text-slate-500">—</li> : null}
          </ul>
        </Section>
        <Section title="7. Dívidas">
          <ul className="space-y-1 text-sm">
            {data.debts.map((d, i) => (
              <li key={i}>
                {d.type}: {formatCurrency(d.monthlyInstallment)}
              </li>
            ))}
            {data.debts.length === 0 ? <li className="text-slate-500">—</li> : null}
          </ul>
        </Section>
        <Section title="8–9. Capacidade">
          <ul className="space-y-1 text-sm">
            <li>
              Comprometimento:{" "}
              {data.capacity.commitmentPct != null
                ? `${Number(data.capacity.commitmentPct)}%`
                : "—"}
            </li>
            <li>
              Capacidade: {formatCurrency(String(data.capacity.estimated ?? ""))}
            </li>
          </ul>
        </Section>
      </div>

      <Section title="10. Simulação">
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          <li>Imóvel: {formatCurrency(String(data.simulation.propertyValue ?? ""))}</li>
          <li>Entrada: {formatCurrency(String(data.simulation.downPayment ?? ""))}</li>
          <li>
            Financiamento:{" "}
            {formatCurrency(String(data.simulation.financedAmount ?? ""))}
          </li>
          <li>Sistema: {String(data.simulation.amortizationSystem ?? "—")}</li>
        </ul>
      </Section>

      <Section title="11. Consistência">
        <p className="text-sm">Score: {data.consistency.score ?? "—"}</p>
      </Section>

      <Section title="12. Pendências">
        <ul className="space-y-1 text-sm">
          {data.pendencies.items.map((p) => (
            <li key={p.id}>
              {p.type}: {p.description}
            </li>
          ))}
          {data.pendencies.openCount === 0 ? (
            <li className="text-slate-500">Nenhuma pendência aberta.</li>
          ) : null}
        </ul>
      </Section>

      <Section title="Matriz de fatores (sem score mágico)">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-1 pr-4">Categoria</th>
              <th className="py-1">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {data.matrix.map((row) => (
              <tr key={row.category} className="border-t border-slate-100">
                <td className="py-1.5 pr-4">{row.category}</td>
                <td className="py-1.5">
                  {MATRIX_ICON[row.result] ?? row.result} — {row.label}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="13. Fatores positivos">
          <FactorList items={data.factors.positive} tone="positive" />
        </Section>
        <Section title="14. Pontos de atenção">
          <FactorList
            items={[...data.factors.attention, ...data.factors.pendencies]}
            tone="attention"
          />
        </Section>
      </div>

      <Section title="15. Evidências">
        <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {data.evidence.map((e) => (
            <li
              key={`${e.documentId}-${e.field}-${e.page}`}
              className="border-b border-slate-50 pb-2"
            >
              <span className="font-medium">{e.field}</span>: {e.value ?? "—"}
              {e.page ? ` · p.${e.page}` : ""}
              {e.evidenceText ? (
                <span className="block text-xs text-slate-500">
                  &quot;{e.evidenceText}&quot;
                </span>
              ) : null}
            </li>
          ))}
          {data.evidence.length === 0 ? (
            <li className="text-slate-500">Sem campos extraídos.</li>
          ) : null}
        </ul>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="16. Histórico">
          <ul className="space-y-1 text-sm">
            {data.history.map((h) => (
              <li key={h.id}>
                {h.fromStatus ?? "—"} → {h.toStatus}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="17. Auditoria">
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {data.audit.map((a) => (
              <li key={a.id}>{a.action}</li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="Parecer do analista">
        <p className="text-sm">Status: {data.review?.status ?? "—"}</p>
        {data.review?.justification ? (
          <p className="mt-2 rounded bg-slate-50 px-3 py-2 text-sm">
            {data.review.justification}
          </p>
        ) : null}
        <textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Justificativa obrigatória…"
          className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          rows={3}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide("APPROVED")}
            className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white"
          >
            Aprovar (interno)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide("REJECTED")}
            className="rounded-md bg-rose-700 px-3 py-2 text-sm text-white"
          >
            Reprovar (interno)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide("RETURNED")}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            Devolver documentação
          </button>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-xl">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FactorList({
  items,
  tone,
}: {
  items: Factor[];
  tone: "positive" | "attention";
}) {
  const color = tone === "positive" ? "text-emerald-800" : "text-amber-900";
  return (
    <ul className={`space-y-3 text-sm ${color}`}>
      {items.map((f) => (
        <li key={`${f.code}-${f.originId ?? f.description}`}>
          <p className="font-medium">
            {tone === "positive" ? "✓" : "⚠"} {f.code}
          </p>
          <p>{f.description}</p>
          <p className="font-mono text-xs text-slate-500">
            Origem: {f.originLabel ?? f.originType}
            {f.originId ? ` #${f.originId.slice(0, 8)}` : ""}
          </p>
        </li>
      ))}
      {items.length === 0 ? <li className="text-slate-500">Nenhum.</li> : null}
    </ul>
  );
}
