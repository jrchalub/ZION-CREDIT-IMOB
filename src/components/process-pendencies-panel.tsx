"use client";

import { useCallback, useEffect, useState } from "react";
import { PENDENCY_STATUS_LABELS } from "@/modules/operations/pendencies/pendency-machine";

type Pendency = {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  dueAt: string | null;
  reviewNote: string | null;
};

const TYPES = [
  { value: "DOCUMENTO_FALTANTE", label: "Documento faltante" },
  { value: "DOCUMENTO_ILEGIVEL", label: "Documento ilegível" },
  { value: "COMPROVANTE_ENDERECO", label: "Comprovante de endereço" },
  { value: "EXTRATO_ADICIONAL", label: "Extrato adicional" },
  { value: "OUTRO", label: "Outro" },
];

/**
 * Analyst self-service pendency board (FASE 6.4).
 */
export function ProcessPendenciesPanel({
  processId,
  canWrite,
}: {
  processId: string;
  canWrite: boolean;
}) {
  const [items, setItems] = useState<Pendency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState(TYPES[0].value);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIA");

  const reload = useCallback(async () => {
    const res = await fetch(`/api/v1/pendencies?processId=${processId}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? "Erro ao carregar pendências");
      return;
    }
    setItems(json.data.items);
    setError(null);
  }, [processId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function create() {
    if (!canWrite) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/pendencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processId,
          type,
          title: title.trim() || undefined,
          description: description.trim(),
          priority,
          notifyClient: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha ao criar pendência");
        return;
      }
      setTitle("");
      setDescription("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function transition(id: string, status: string, reviewNote?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/pendencies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha na transição");
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-serif text-xl">Pendências self-service</h2>
        <p className="mt-1 text-sm text-slate-600">
          OPEN → SUBMITTED → UNDER_REVIEW → RESOLVED / REJECTED
        </p>
      </div>

      {canWrite ? (
        <div className="grid gap-3 rounded-md border border-slate-100 bg-slate-50/80 p-4 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            Título
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Novo comprovante de endereço"
            />
          </label>
          <label className="text-sm">
            Tipo
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Prioridade
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="BAIXA">Baixa</option>
              <option value="MEDIA">Média</option>
              <option value="ALTA">Alta</option>
              <option value="CRITICA">Crítica</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            Descrição
            <textarea
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Oriente o cliente sobre o que enviar"
            />
          </label>
          <button
            type="button"
            disabled={busy || description.trim().length < 3}
            onClick={() => void create()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:col-span-2 sm:w-fit"
          >
            Criar pendência e notificar
          </button>
        </div>
      ) : null}

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-md border border-slate-100 px-3 py-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {item.title || item.type}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    (
                    {PENDENCY_STATUS_LABELS[
                      item.status as keyof typeof PENDENCY_STATUS_LABELS
                    ] ?? item.status}{" "}
                    · {item.priority})
                  </span>
                </p>
                <p className="mt-1 text-slate-600">{item.description}</p>
                {item.reviewNote ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Nota: {item.reviewNote}
                  </p>
                ) : null}
              </div>
              {canWrite ? (
                <div className="flex flex-wrap gap-1">
                  {item.status === "SUBMITTED" || item.status === "OPEN" ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      onClick={() => void transition(item.id, "UNDER_REVIEW")}
                    >
                      Revisar
                    </button>
                  ) : null}
                  {item.status === "UNDER_REVIEW" ||
                  item.status === "SUBMITTED" ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded border border-teal-300 px-2 py-1 text-xs text-teal-800 hover:bg-teal-50"
                        onClick={() => void transition(item.id, "RESOLVED")}
                      >
                        Resolver
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-900 hover:bg-amber-50"
                        onClick={() =>
                          void transition(
                            item.id,
                            "REJECTED",
                            "Documentação insuficiente — reenvie",
                          )
                        }
                      >
                        Rejeitar
                      </button>
                    </>
                  ) : null}
                  {item.status !== "RESOLVED" &&
                  item.status !== "CANCELLED" ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                      onClick={() => void transition(item.id, "CANCELLED")}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="text-sm text-slate-500">Nenhuma pendência.</li>
        ) : null}
      </ul>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
