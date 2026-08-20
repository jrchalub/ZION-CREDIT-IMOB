"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PROCESS_STATUS_LABELS,
  type ProcessStatus,
} from "@/domain/process/status-machine";

export function ProcessActions({
  processId,
  allowedTransitions,
}: {
  processId: string;
  allowedTransitions: ProcessStatus[];
}) {
  const router = useRouter();
  const [toStatus, setToStatus] = useState<ProcessStatus | "">(
    allowedTransitions[0] ?? "",
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (allowedTransitions.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Este status não possui transições disponíveis.
      </p>
    );
  }

  async function onTransition() {
    if (!toStatus) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/processes/${processId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus, reason: reason || null }),
      });
      const json = await response.json();
      if (!response.ok) {
        setError(json?.error?.message ?? "Falha na transição");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        Novo status
        <select
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          value={toStatus}
          onChange={(e) => setToStatus(e.target.value as ProcessStatus)}
        >
          {allowedTransitions.map((status) => (
            <option key={status} value={status}>
              {PROCESS_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Motivo (auditoria)
        <textarea
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <button
        type="button"
        onClick={onTransition}
        disabled={loading || !toStatus}
        className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60"
      >
        {loading ? "Atualizando..." : "Alterar status"}
      </button>
    </div>
  );
}
