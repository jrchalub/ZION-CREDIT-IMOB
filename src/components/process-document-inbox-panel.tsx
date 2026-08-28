"use client";

import { useCallback, useEffect, useState } from "react";

type InboxSummary = {
  counters: {
    received: number;
    processing: number;
    organized: number;
    pendencies: number;
  };
  unidentified: Array<{
    id: string;
    originalFilename: string;
    suggestedTypeCode: string | null;
    reason: string;
  }>;
  visual: Array<{
    code: string;
    label: string;
    category: string;
    ok: boolean;
    warning: string | null;
    required: boolean;
  }>;
  periods: {
    extratos: {
      months: Array<{ competence: string; label: string; present: boolean }>;
      complete: boolean;
      headline: string;
    } | null;
    faturas: {
      months: Array<{ competence: string; label: string; present: boolean }>;
      complete: boolean;
      headline: string;
    } | null;
    contracheques: {
      months: Array<{ competence: string; label: string; present: boolean }>;
      complete: boolean;
      headline: string;
    } | null;
  };
  status: string;
  statusLabel: string;
  disclaimer: string;
  pendency: string | null;
  types: Array<{ code: string; name: string }>;
};

export function ProcessDocumentInboxPanel({ processId }: { processId: string }) {
  const [summary, setSummary] = useState<InboxSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [assigns, setAssigns] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    const res = await fetch(`/api/v1/processes/${processId}/documents/inbox`);
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? "Erro ao carregar caixa de documentos");
      return;
    }
    setSummary(json.data);
    setError(null);
  }, [processId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      const res = await fetch(`/api/v1/processes/${processId}/documents/inbox`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha no upload em lote");
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function assignType(documentId: string) {
    const documentTypeCode = assigns[documentId];
    if (!documentTypeCode) {
      setError("Documento não identificado — selecione o tipo");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/documents/inbox`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, documentTypeCode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha ao classificar");
        return;
      }
      setSummary(json.data);
    } finally {
      setBusy(false);
    }
  }

  const grouped = new Map<string, NonNullable<InboxSummary["visual"]>>();
  for (const item of summary?.visual ?? []) {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-serif text-xl">Caixa de documentos</h2>
        <p className="mt-1 text-sm text-slate-600">
          Arraste os arquivos desorganizados do WhatsApp. A IA identifica e organiza
          no checklist — sem enviar ao banco.
        </p>
      </div>

      <label
        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm ${
          dragging
            ? "border-teal-600 bg-teal-50"
            : "border-slate-300 bg-slate-50"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void uploadFiles(event.dataTransfer.files);
        }}
      >
        <span className="font-medium tracking-wide text-slate-700 uppercase">
          Arraste a documentação aqui
        </span>
        <span className="mt-1 text-xs text-slate-500">
          Vários arquivos de uma vez (PDF, JPG, PNG)
        </span>
        <input
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          disabled={busy}
          onChange={(event) => {
            if (event.target.files) void uploadFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>

      {summary ? (
        <div className="grid grid-cols-2 gap-2 text-center text-sm md:grid-cols-4">
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Arquivos recebidos</p>
            <p className="text-xl font-semibold">{summary.counters.received}</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Processando</p>
            <p className="text-xl font-semibold">{summary.counters.processing}</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Organizados</p>
            <p className="text-xl font-semibold">{summary.counters.organized}</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Pendências</p>
            <p className="text-xl font-semibold">{summary.counters.pendencies}</p>
          </div>
        </div>
      ) : null}

      {summary?.unidentified.length ? (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">
            Documento não identificado — selecione o tipo
          </p>
          {summary.unidentified.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <span className="flex-1 truncate">{item.originalFilename}</span>
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                value={assigns[item.id] ?? ""}
                onChange={(event) =>
                  setAssigns((prev) => ({
                    ...prev,
                    [item.id]: event.target.value,
                  }))
                }
              >
                <option value="">Selecione…</option>
                {summary.types.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={() => void assignType(item.id)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
              >
                Organizar
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {summary ? (
        <div className="space-y-3">
          <h3 className="font-serif text-lg">Documentação do processo</h3>
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                {category}
              </p>
              <ul className="mt-1 space-y-1 text-sm">
                {items.map((item) => (
                  <li key={`${item.code}-${item.label}`}>
                    {item.ok && !item.warning ? "✓" : "⚠"} {item.label}
                    {item.warning && !item.ok ? ` — ${item.warning}` : ""}
                    {item.ok && item.warning ? ` — ${item.warning}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {summary.periods.extratos ? (
            <div className="rounded-md border border-slate-100 p-3 text-sm">
              <p className="font-medium">{summary.periods.extratos.headline}</p>
              <p className="mt-1 text-xs text-slate-600">
                {summary.periods.extratos.months
                  .map((m) => `${m.label} ${m.present ? "✓" : "✗"}`)
                  .join(" · ")}
              </p>
            </div>
          ) : null}
          {summary.periods.faturas ? (
            <div className="rounded-md border border-slate-100 p-3 text-sm">
              <p className="font-medium">{summary.periods.faturas.headline}</p>
              <p className="mt-1 text-xs text-slate-600">
                {summary.periods.faturas.months
                  .map((m) => `${m.label} ${m.present ? "✓" : "✗"}`)
                  .join(" · ")}
              </p>
            </div>
          ) : null}
          {summary.periods.contracheques ? (
            <div className="rounded-md border border-slate-100 p-3 text-sm">
              <p className="font-medium">
                {summary.periods.contracheques.headline}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {summary.periods.contracheques.months
                  .map((m) => `${m.label} ${m.present ? "✓" : "✗"}`)
                  .join(" · ")}
              </p>
            </div>
          ) : null}

          <p
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              summary.status === "APROVADA_PARA_ANALISE"
                ? "bg-emerald-50 text-emerald-900"
                : "bg-amber-50 text-amber-900"
            }`}
          >
            {summary.statusLabel}
          </p>
          {summary.pendency ? (
            <p className="text-sm text-rose-700">Pendência: {summary.pendency}</p>
          ) : null}
          <p className="text-xs text-slate-500">{summary.disclaimer}</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {busy ? <p className="text-xs text-slate-500">Processando…</p> : null}

      <button
        type="button"
        className="text-xs text-teal-800 hover:underline"
        onClick={() => void reload()}
      >
        Atualizar status
      </button>
    </section>
  );
}
