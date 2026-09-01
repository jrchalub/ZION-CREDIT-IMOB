"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Field = {
  id: string;
  field: string;
  value: string | null;
  confidence: string | null;
  page: number | null;
  evidenceText: string | null;
};

type Intelligence = {
  document: { id: string; status: string; processId: string; originalFilename: string };
  processingRun: { status: string; errorMessage: string | null } | null;
  classification: {
    suggestedTypeCode: string;
    confidence: string;
    decision: string;
  } | null;
  fields: Field[];
  consistency: {
    consistencyScore: number | null;
    issues: Array<{ type: string; message: string }>;
    factors: Array<{ label: string; positive: boolean }>;
  } | null;
  notes: { pipelineCompletedDoesNotMeanValidated: boolean };
};

export function DocumentReviewPanel({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [data, setData] = useState<Intelligence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/v1/documents/${documentId}/intelligence`);
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? "Erro ao carregar inteligência");
      return;
    }
    setData(json.data);
  }, [documentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function openViewer() {
    const res = await fetch(`/api/v1/documents/${documentId}?view=1`);
    const json = await res.json();
    if (res.ok) setViewerUrl(json.data.url);
  }

  async function reprocessSync() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/reprocess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "sync" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha no reprocessamento");
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function review(action: "VALIDAR" | "REJEITAR") {
    const reason =
      action === "REJEITAR" ? window.prompt("Motivo da rejeição") : null;
    if (action === "REJEITAR" && !reason) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha na revisão");
        return;
      }
      await reload();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function correctField(field: Field) {
    const corrected = window.prompt(`Corrigir ${field.field}`, field.value ?? "");
    if (!corrected) return;
    const reason = window.prompt("Motivo da correção") ?? "Correção manual";
    const res = await fetch(`/api/v1/documents/${documentId}/intelligence`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        field: field.field,
        extractedFieldId: field.id,
        aiValue: field.value,
        correctedValue: corrected,
        reason,
      }),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json?.error?.message ?? "Falha ao corrigir");
      return;
    }
    await reload();
  }

  if (!data) {
    return <p className="text-sm text-slate-600">{error ?? "Carregando..."}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/processes/${data.document.processId}`}
            className="text-sm text-teal-800 hover:underline"
          >
            ← Voltar ao processo
          </Link>
          <h1 className="mt-2 font-serif text-3xl">Revisão de documento</h1>
          <p className="mt-1 text-sm text-slate-600">
            {data.document.originalFilename} · Documento: {data.document.status}
            {data.processingRun
              ? ` · Pipeline: ${data.processingRun.status}`
              : " · Pipeline: não iniciado"}
          </p>
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Pipeline COMPLETED ≠ documento VALIDADO. A IA não valida definitivamente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void openViewer()}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Abrir arquivo
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void reprocessSync()}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Reprocessar (sync)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void review("VALIDAR")}
            className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-600"
          >
            Validar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void review("REJEITAR")}
            className="rounded-md bg-rose-700 px-3 py-2 text-sm text-white hover:bg-rose-600"
          >
            Rejeitar
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl">Arquivo / OCR</h2>
          {viewerUrl ? (
            <iframe
              title="Documento"
              src={viewerUrl}
              className="mt-3 h-[420px] w-full rounded border border-slate-200"
            />
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Clique em &quot;Abrir arquivo&quot; para visualizar o documento.
            </p>
          )}
          {data.classification ? (
            <p className="mt-4 text-sm">
              Classificação sugerida:{" "}
              <strong>{data.classification.suggestedTypeCode}</strong> (
              {(Number(data.classification.confidence) * 100).toFixed(0)}%) ·{" "}
              {data.classification.decision}
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl">Dados extraídos + evidências</h2>
          <ul className="mt-4 space-y-3">
            {data.fields.map((field) => (
              <li key={field.id} className="rounded-md border border-slate-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs tracking-wide text-slate-500 uppercase">
                      {field.field}
                    </p>
                    <p className="font-medium">{field.value ?? "—"}</p>
                    <p className="text-xs text-slate-500">
                      Confiança:{" "}
                      {field.confidence
                        ? `${(Number(field.confidence) * 100).toFixed(0)}%`
                        : "—"}
                      {field.page ? ` · Página ${field.page}` : ""}
                    </p>
                    {field.evidenceText ? (
                      <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                        Evidência: &quot;{field.evidenceText}&quot;
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-teal-800 hover:underline"
                    onClick={() => void correctField(field)}
                  >
                    Corrigir
                  </button>
                </div>
              </li>
            ))}
            {data.fields.length === 0 ? (
              <li className="text-sm text-slate-500">
                Nenhum campo extraído ainda. Reprocesse o documento.
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      {data.consistency ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl">Consistência</h2>
          <p className="mt-2 font-serif text-3xl">
            {data.consistency.consistencyScore ?? "—"}
          </p>
          <p className="text-xs text-slate-500">
            Indicador interno explicável — não é aprovação de crédito.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {(data.consistency.factors ?? []).map((f) => (
              <li key={f.label} className={f.positive ? "text-emerald-800" : "text-rose-800"}>
                {f.positive ? "+" : "-"} {f.label}
              </li>
            ))}
            {(data.consistency.issues ?? []).map((issue) => (
              <li key={`${issue.type}-${issue.message}`} className="text-rose-800">
                {issue.type}: {issue.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
