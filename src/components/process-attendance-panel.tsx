"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Attendance = {
  processNumber: string;
  clientName: string | null;
  whatsapp: string | null;
  linked: boolean;
  externalConversationId: string | null;
  lastInteractionAt: string | null;
  nextVisitAt: string | null;
  nextVisitLocation: string | null;
  notes: string | null;
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(local: string) {
  if (!local) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function ProcessAttendancePanel({ processId }: { processId: string }) {
  const [data, setData] = useState<Attendance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/v1/processes/${processId}/attendance`);
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? "Erro ao carregar atendimento");
      return;
    }
    setData(json.data);
    setError(null);
  }, [processId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalConversationId:
            String(form.get("externalConversationId") ?? "") || null,
          nextVisitAt: toIso(String(form.get("nextVisitAt") ?? "")),
          nextVisitLocation: String(form.get("nextVisitLocation") ?? "") || null,
          notes: String(form.get("notes") ?? "") || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha ao salvar atendimento");
        return;
      }
      setData(json.data);
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl">Atendimento</h2>
        {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-xl">Atendimento</h2>
      <p className="mt-1 text-sm text-slate-600">
        Vínculo com o CRM/WhatsApp existente — sem chat nesta tela.
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Cliente</dt>
          <dd>{data.clientName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">WhatsApp</dt>
          <dd>{data.whatsapp ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Processo</dt>
          <dd className="font-mono text-xs">{data.processNumber}</dd>
        </div>
        <div>
          <dt className="text-slate-500">CRM</dt>
          <dd>{data.linked ? "Conversa vinculada" : "Sem vínculo"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Última interação</dt>
          <dd>
            {data.lastInteractionAt
              ? new Date(data.lastInteractionAt).toLocaleString("pt-BR")
              : "—"}
          </dd>
        </div>
      </dl>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <label className="block text-sm">
          ID da conversa (CRM)
          <input
            name="externalConversationId"
            defaultValue={data.externalConversationId ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Próxima visita
            <input
              type="datetime-local"
              name="nextVisitAt"
              defaultValue={toLocalInput(data.nextVisitAt)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Local
            <input
              name="nextVisitLocation"
              defaultValue={data.nextVisitLocation ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          Observações
          <textarea
            name="notes"
            rows={3}
            defaultValue={data.notes ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? "Salvando…" : "Salvar atendimento"}
        </button>
      </form>
    </section>
  );
}
