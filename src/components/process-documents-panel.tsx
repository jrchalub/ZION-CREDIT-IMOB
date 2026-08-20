"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ChecklistItem = {
  id: string;
  label: string;
  status: string;
  requirement: string;
  competence: string | null;
  documentId: string | null;
  documentTypeCode: string;
  notes: string | null;
  conditionKey: string | null;
};

type DocumentRow = {
  id: string;
  originalFilename: string;
  mimeType: string;
  status: string;
  typeName: string;
  sizeBytes: number;
};

type Pendency = {
  id: string;
  type: string;
  description: string;
  priority: string;
  status: string;
};

export function ProcessDocumentsPanel({ processId }: { processId: string }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [progress, setProgress] = useState({ percent: 0, pending: 0, validated: 0 });
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [pendencies, setPendencies] = useState<Pendency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerMime, setViewerMime] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    const [checklistRes, docsRes, pendRes] = await Promise.all([
      fetch(`/api/v1/processes/${processId}/checklist?ensure=1`),
      fetch(`/api/v1/processes/${processId}/documents`),
      fetch(`/api/v1/pendencies?processId=${processId}`),
    ]);
    const checklistJson = await checklistRes.json();
    const docsJson = await docsRes.json();
    const pendJson = await pendRes.json();
    if (!checklistRes.ok) {
      setError(checklistJson?.error?.message ?? "Erro ao carregar checklist");
      return;
    }
    setItems(checklistJson.data.items);
    setProgress(checklistJson.data.progress);
    setDocuments(docsJson.data?.items ?? []);
    setPendencies(pendJson.data?.items ?? []);
  }, [processId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onUpload(checklistItemId: string, file: File) {
    setBusyId(checklistItemId);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("checklistItemId", checklistItemId);
      const response = await fetch(`/api/v1/processes/${processId}/documents`, {
        method: "POST",
        body: form,
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json?.error?.message ?? "Falha no upload");
        return;
      }
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  async function markNotApplicable(checklistItemId: string) {
    setBusyId(checklistItemId);
    try {
      const response = await fetch(`/api/v1/processes/${processId}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklistItemId,
          action: "NAO_APLICAVEL",
          notes: "Cliente sem cartão de crédito",
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json?.error?.message ?? "Falha ao atualizar item");
        return;
      }
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  async function openViewer(documentId: string) {
    const response = await fetch(`/api/v1/documents/${documentId}?view=1`);
    const json = await response.json();
    if (!response.ok) {
      setError(json?.error?.message ?? "Falha ao gerar URL");
      return;
    }
    setViewerUrl(json.data.url);
    setViewerMime(json.data.mimeType);
  }

  async function review(documentId: string, action: "VALIDAR" | "REJEITAR") {
    const reason =
      action === "REJEITAR"
        ? window.prompt("Motivo da rejeição")
        : null;
    if (action === "REJEITAR" && !reason) return;

    const response = await fetch(`/api/v1/documents/${documentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json?.error?.message ?? "Falha na revisão");
      return;
    }
    await reload();
  }

  async function resolvePendency(id: string) {
    await fetch(`/api/v1/pendencies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RESOLVIDA" }),
    });
    await reload();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl">Documentação</h2>
            <p className="mt-1 text-sm text-slate-600">
              Checklist dinâmico por perfil · storage privado (MinIO)
            </p>
          </div>
          <div className="text-right">
            <p className="font-serif text-3xl text-slate-900">{progress.percent}%</p>
            <p className="text-xs text-slate-500">
              {progress.validated} validados · {progress.pending} pendentes
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 rounded bg-slate-100">
          <div
            className="h-2 rounded bg-teal-600 transition-all"
            style={{ width: `${progress.percent}%` }}
          />
        </div>

        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}

        <ul className="mt-5 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 rounded-md border border-slate-200 p-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-slate-500">
                  {item.documentTypeCode} · {item.requirement} · {item.status}
                  {item.notes ? ` · ${item.notes}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.status === "PENDENTE" || item.status === "REJEITADO" ? (
                  <label className="cursor-pointer rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
                    {busyId === item.id ? "Enviando..." : "Upload"}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                      disabled={busyId === item.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void onUpload(item.id, file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                ) : null}
                {item.conditionKey === "HAS_CREDIT_CARD" &&
                item.status === "PENDENTE" ? (
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
                    onClick={() => void markNotApplicable(item.id)}
                  >
                    Sem cartão
                  </button>
                ) : null}
                {item.documentId ? (
                  <button
                    type="button"
                    className="rounded-md border border-teal-700 px-3 py-1.5 text-xs text-teal-800 hover:bg-teal-50"
                    onClick={() => void openViewer(item.documentId!)}
                  >
                    Visualizar
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-serif text-lg">Documentos enviados</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-2 border-b border-slate-100 py-2"
              >
                <div>
                  <p className="font-medium">{doc.typeName}</p>
                  <p className="text-xs text-slate-500">
                    {doc.originalFilename} · {doc.status}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Link
                    href={`/documents/${doc.id}/review`}
                    className="rounded px-2 py-1 text-xs text-indigo-800 hover:bg-indigo-50"
                  >
                    Revisar IA
                  </Link>
                  <button
                    type="button"
                    className="rounded px-2 py-1 text-xs text-teal-800 hover:bg-teal-50"
                    onClick={() => void openViewer(doc.id)}
                  >
                    Ver
                  </button>
                  {doc.status !== "VALIDADO" ? (
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-50"
                      onClick={() => void review(doc.id, "VALIDAR")}
                    >
                      Validar
                    </button>
                  ) : null}
                  {doc.status !== "REJEITADO" ? (
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs text-rose-800 hover:bg-rose-50"
                      onClick={() => void review(doc.id, "REJEITAR")}
                    >
                      Rejeitar
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
            {documents.length === 0 ? (
              <li className="text-slate-500">Nenhum documento enviado.</li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-serif text-lg">Pendências</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {pendencies.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-2 border-b border-slate-100 py-2"
              >
                <div>
                  <p className="font-medium">
                    {item.type} · {item.priority}
                  </p>
                  <p className="text-xs text-slate-600">{item.description}</p>
                  <p className="text-xs text-slate-400">{item.status}</p>
                </div>
                {item.status === "ABERTA" ? (
                  <button
                    type="button"
                    className="rounded px-2 py-1 text-xs hover:bg-slate-50"
                    onClick={() => void resolvePendency(item.id)}
                  >
                    Resolver
                  </button>
                ) : null}
              </li>
            ))}
            {pendencies.length === 0 ? (
              <li className="text-slate-500">Sem pendências abertas.</li>
            ) : null}
          </ul>
        </div>
      </section>

      {viewerUrl ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-serif text-lg">Visualizador (URL assinada temporária)</h3>
            <button
              type="button"
              className="text-sm text-slate-600 hover:underline"
              onClick={() => {
                setViewerUrl(null);
                setViewerMime(null);
              }}
            >
              Fechar
            </button>
          </div>
          {viewerMime?.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={viewerUrl} alt="Documento" className="max-h-[70vh] w-auto rounded" />
          ) : (
            <iframe
              title="Documento"
              src={viewerUrl}
              className="h-[70vh] w-full rounded border border-slate-200"
            />
          )}
          <p className="mt-2 text-xs text-slate-500">
            URL expira em ~2 minutos. Nunca é pública permanente.
          </p>
        </section>
      ) : null}
    </div>
  );
}
