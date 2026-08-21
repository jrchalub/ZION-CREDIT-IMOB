"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ChecklistFile = {
  id: string;
  originalFilename: string;
  mimeType: string;
  status: string;
  sizeBytes: number;
  documentDate: string | null;
  validUntil: string | null;
  expired: boolean;
};

type ChecklistItem = {
  id: string;
  label: string;
  status: string;
  requirement: string;
  competence: string | null;
  documentId: string | null;
  documentTypeCode: string;
  documentTypeDescription: string | null;
  annexNumber: number | null;
  validityDays: number | null;
  notes: string | null;
  conditionKey: string | null;
  allowsMultiple: boolean;
  multipleHint: string | null;
  files: ChecklistFile[];
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

function formatBrDate(iso: string | null) {
  if (!iso) return null;
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function ProcessDocumentsPanel({ processId }: { processId: string }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [progress, setProgress] = useState({ percent: 0, pending: 0, validated: 0 });
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [pendencies, setPendencies] = useState<Pendency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerMime, setViewerMime] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [documentDates, setDocumentDates] = useState<Record<string, string>>({});

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

  async function onUpload(checklistItemId: string, fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    const item = items.find((row) => row.id === checklistItemId);
    if (item?.validityDays && !documentDates[checklistItemId]) {
      setError(
        `Informe a data do comprovante (validade de ${item.validityDays} dias).`,
      );
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
        const response = await fetch(`/api/v1/processes/${processId}/documents`, {
          method: "POST",
          body: form,
        });
        const json = await response.json();
        if (!response.ok) {
          setError(json?.error?.message ?? "Falha no upload");
          return;
        }
      }
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  async function markNotApplicable(checklistItemId: string, notes: string) {
    setBusyId(checklistItemId);
    try {
      const response = await fetch(`/api/v1/processes/${processId}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklistItemId,
          action: "NAO_APLICAVEL",
          notes,
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
      body: JSON.stringify({ status: "RESOLVED" }),
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
              Anexos Caixa (1–12) · storage privado (MinIO)
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
          {items.map((item) => {
            const files = item.files ?? [];
            const hasExpired = files.some(
              (file) => file.expired || file.status === "EXPIRADO",
            );
            const canAdd =
              item.status !== "NAO_APLICAVEL" &&
              (item.allowsMultiple
                ? true
                : item.status === "PENDENTE" ||
                  item.status === "REJEITADO" ||
                  hasExpired);
            const uploadLabel =
              busyId === item.id
                ? "Enviando..."
                : files.length === 0
                  ? "Upload"
                  : item.allowsMultiple
                    ? "Adicionar arquivo"
                    : "Reenviar";

            return (
            <li
              key={item.id}
              className="flex flex-col gap-3 rounded-md border border-slate-200 p-3"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 gap-3">
                {item.annexNumber ? (
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    {item.annexNumber}
                  </span>
                ) : null}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-slate-500">
                    {item.documentTypeCode} · {item.requirement} · {item.status}
                    {item.allowsMultiple ? " · vários arquivos" : ""}
                    {item.validityDays
                      ? ` · validade ${item.validityDays} dias`
                      : ""}
                    {files.length > 0
                      ? ` · ${files.length} arquivo${files.length === 1 ? "" : "s"}`
                      : ""}
                    {item.notes ? ` · ${item.notes}` : ""}
                  </p>
                  {item.documentTypeDescription ? (
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {item.documentTypeDescription}
                    </p>
                  ) : null}
                  {item.multipleHint ? (
                    <p className="mt-1 text-xs font-medium text-teal-800">
                      {item.multipleHint}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:shrink-0">
                {item.validityDays && canAdd ? (
                  <label className="text-xs text-slate-600">
                    Data do comprovante
                    <input
                      type="date"
                      className="ml-2 rounded border border-slate-300 px-2 py-1 text-xs"
                      value={documentDates[item.id] ?? ""}
                      onChange={(e) =>
                        setDocumentDates((current) => ({
                          ...current,
                          [item.id]: e.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}
                {canAdd ? (
                  <label className="cursor-pointer rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
                    {uploadLabel}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                      multiple={item.allowsMultiple}
                      disabled={busyId === item.id}
                      onChange={(e) => {
                        const selected = e.target.files;
                        if (selected && selected.length > 0) {
                          void onUpload(item.id, selected);
                        }
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
                    onClick={() =>
                      void markNotApplicable(item.id, "Cliente sem cartão de crédito")
                    }
                  >
                    Sem cartão
                  </button>
                ) : null}
                {item.conditionKey === "FATOR_SOCIAL" &&
                item.status === "PENDENTE" ? (
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
                    onClick={() =>
                      void markNotApplicable(
                        item.id,
                        "Não se aplica — sem enquadramento Minha Casa Minha Vida / sem dependentes",
                      )
                    }
                  >
                    Não se aplica
                  </button>
                ) : null}
              </div>
              </div>
              {files.length > 0 ? (
                <ul className="space-y-1 border-t border-slate-100 pt-2">
                  {files.map((file) => (
                    <li
                      key={file.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <p className="min-w-0 truncate text-slate-700">
                        {file.originalFilename}
                        <span className="ml-2 text-slate-400">{file.status}</span>
                        {file.validUntil ? (
                          <span
                            className={
                              file.expired || file.status === "EXPIRADO"
                                ? "ml-2 font-medium text-rose-700"
                                : "ml-2 text-slate-500"
                            }
                          >
                            {file.expired || file.status === "EXPIRADO"
                              ? `Vencido em ${formatBrDate(file.validUntil)}`
                              : `Válido até ${formatBrDate(file.validUntil)}`}
                          </span>
                        ) : null}
                      </p>
                      <div className="flex gap-1">
                        <Link
                          href={`/documents/${file.id}/review`}
                          className="rounded px-2 py-1 text-indigo-800 hover:bg-indigo-50"
                        >
                          Revisar
                        </Link>
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-teal-800 hover:bg-teal-50"
                          onClick={() => void openViewer(file.id)}
                        >
                          Ver
                        </button>
                        {file.status !== "VALIDADO" &&
                        file.status !== "EXPIRADO" &&
                        !file.expired ? (
                          <button
                            type="button"
                            className="rounded px-2 py-1 text-emerald-800 hover:bg-emerald-50"
                            onClick={() => void review(file.id, "VALIDAR")}
                          >
                            Validar
                          </button>
                        ) : null}
                        {file.status !== "REJEITADO" ? (
                          <button
                            type="button"
                            className="rounded px-2 py-1 text-rose-800 hover:bg-rose-50"
                            onClick={() => void review(file.id, "REJEITAR")}
                          >
                            Rejeitar
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
            );
          })}
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
                {item.status === "OPEN" || item.status === "SUBMITTED" ? (
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
