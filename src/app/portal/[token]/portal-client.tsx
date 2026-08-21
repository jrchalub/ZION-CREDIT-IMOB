"use client";

import { useCallback, useEffect, useState } from "react";

type PortalView = {
  greetingName: string;
  processNumber: string;
  statusMessage: string;
  progressPercent: number;
  documents: Array<{
    checklistItemId: string;
    label: string;
    typeName: string;
    status: string;
    needsUpload: boolean;
    canUpload: boolean;
    canAddMore: boolean;
    allowsMultiple: boolean;
    validityDays: number | null;
    files: Array<{
      id: string;
      originalFilename: string;
      status: string;
      documentDate: string | null;
      validUntil: string | null;
    }>;
  }>;
  pendencies: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    checklistItemId: string | null;
  }>;
};

const STATUS_ICON: Record<string, string> = {
  VALIDADO: "✓",
  ENVIADO: "✓",
  PENDENTE: "○",
  REJEITADO: "⚠",
  EXPIRADO: "⚠",
};

export function ClientPortalPage({ token }: { token: string }) {
  const [data, setData] = useState<PortalView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [documentDates, setDocumentDates] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    const res = await fetch(`/api/v1/portal/${encodeURIComponent(token)}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? "Não foi possível abrir o portal");
      setData(null);
      return;
    }
    setData(json.data);
    setError(null);
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onUpload(checklistItemId: string, fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    const item = data?.documents.find((row) => row.checklistItemId === checklistItemId);
    if (item?.validityDays && !documentDates[checklistItemId]) {
      setError(`Informe a data do comprovante (validade de ${item.validityDays} dias).`);
      return;
    }
    setBusyId(checklistItemId);
    setError(null);
    try {
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        form.append("checklistItemId", checklistItemId);
        if (documentDates[checklistItemId]) {
          form.append("documentDate", documentDates[checklistItemId]);
        }
        const res = await fetch(
          `/api/v1/portal/${encodeURIComponent(token)}/documents`,
          { method: "POST", body: form },
        );
        const json = await res.json();
        if (!res.ok) {
          setError(json?.error?.message ?? "Falha no envio");
          return;
        }
      }
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  async function acknowledgePendency(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(
        `/api/v1/portal/${encodeURIComponent(token)}/pendencies/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "SUBMITTED" }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha ao responder");
        return;
      }
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  if (error && !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-6 text-center shadow-sm">
        <h1 className="font-serif text-2xl text-slate-900">Acesso indisponível</h1>
        <p className="mt-2 text-sm text-red-700">{error}</p>
        <p className="mt-4 text-xs text-slate-500">
          Solicite um novo link à equipe responsável pelo seu financiamento.
        </p>
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-sm text-slate-500">Carregando…</p>;
  }

  const needed = data.documents.filter((d) => d.needsUpload || d.canAddMore);

  return (
    <div className="space-y-6">
      <section className="text-center">
        <h1 className="font-serif text-3xl text-slate-900">
          Olá, {data.greetingName}
        </h1>
        <p className="mt-2 text-base text-slate-600">{data.statusMessage}</p>
        <p className="mt-1 font-mono text-xs text-slate-400">
          {data.processNumber}
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs tracking-wide text-slate-500 uppercase">
          Progresso
        </p>
        <div className="mt-3 h-3 overflow-hidden rounded bg-slate-100">
          <div
            className="h-3 rounded bg-teal-600 transition-all"
            style={{ width: `${Math.max(4, data.progressPercent)}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-slate-600">{data.progressPercent}%</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl">Documentação</h2>
        <ul className="mt-4 space-y-2">
          {data.documents.map((doc) => (
            <li
              key={doc.checklistItemId}
              className="flex items-start gap-2 text-sm"
            >
              <span className="mt-0.5 w-4 shrink-0 text-center font-medium text-teal-700">
                {STATUS_ICON[doc.status] ?? "○"}
              </span>
              <span>
                <span className="font-medium">{doc.label}</span>
                {doc.files.length > 0 ? (
                  <span className="ml-1 text-slate-500">
                    · {doc.files.length} arquivo{doc.files.length === 1 ? "" : "s"}
                  </span>
                ) : null}
                {doc.status === "REJEITADO" ? (
                  <span className="ml-1 text-amber-700">— reenvie</span>
                ) : null}
                {doc.files.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                    {doc.files.map((file) => (
                      <li key={file.id}>
                        {file.originalFilename} · {file.status}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {needed.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-5">
          <h2 className="font-serif text-xl text-slate-900">
            {needed.some((d) => d.needsUpload)
              ? "Precisamos de"
              : "Adicionar arquivos"}
          </h2>
          <ul className="mt-4 space-y-4">
            {needed.map((doc) => (
              <li key={doc.checklistItemId} className="text-sm">
                <p className="font-medium">📄 {doc.label}</p>
                {doc.validityDays ? (
                  <p className="mt-1 text-xs text-slate-600">
                    O comprovante precisa ter no máximo {doc.validityDays} dias.
                    Informe a data impressa no documento.
                  </p>
                ) : null}
                {doc.canAddMore ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Você já enviou {doc.files.length} arquivo
                    {doc.files.length === 1 ? "" : "s"}. Pode adicionar outro neste
                    mesmo item.
                  </p>
                ) : null}
                {doc.validityDays ? (
                  <label className="mt-2 block text-xs text-slate-600">
                    Data do comprovante
                    <input
                      type="date"
                      className="ml-2 rounded border border-slate-300 px-2 py-1 text-xs"
                      value={documentDates[doc.checklistItemId] ?? ""}
                      onChange={(e) =>
                        setDocumentDates((current) => ({
                          ...current,
                          [doc.checklistItemId]: e.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}
                <label className="mt-2 inline-flex cursor-pointer items-center rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800">
                  {busyId === doc.checklistItemId
                    ? "Enviando…"
                    : doc.canAddMore
                      ? "Adicionar arquivo"
                      : "Enviar documento"}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                    multiple={doc.allowsMultiple}
                    disabled={busyId === doc.checklistItemId}
                    onChange={(e) => {
                      const selected = e.target.files;
                      if (selected && selected.length > 0) {
                        void onUpload(doc.checklistItemId, selected);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.pendencies.length > 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl">Pendências</h2>
          <ul className="mt-4 space-y-3">
            {data.pendencies.map((p) => (
              <li
                key={p.id}
                className="rounded-md border border-slate-100 px-3 py-2 text-sm"
              >
                <p className="font-medium">{p.title || p.type}</p>
                <p className="mt-1 text-slate-600">{p.description}</p>
                {p.status === "OPEN" || p.status === "REJECTED" ? (
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => void acknowledgePendency(p.id)}
                    className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                  >
                    {busyId === p.id ? "…" : "Confirmar que estou resolvendo"}
                  </button>
                ) : p.status === "SUBMITTED" ? (
                  <p className="mt-2 text-xs text-teal-700">Enviado — aguardando revisão</p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">{p.status}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {error ? <p className="text-center text-sm text-red-700">{error}</p> : null}

      <p className="text-center text-xs text-slate-500">
        Este link é pessoal e temporário. Não compartilhe dados bancários por
        canais não oficiais.
      </p>
    </div>
  );
}
