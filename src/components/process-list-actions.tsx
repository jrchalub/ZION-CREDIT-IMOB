"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProcessListActions({
  processId,
  processNumber,
  canWrite,
  canCancel,
  canHardDelete,
}: {
  processId: string;
  processNumber: string;
  canWrite: boolean;
  canCancel: boolean;
  canHardDelete: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cancelProcess() {
    if (
      !window.confirm(
        `Cancelar o processo ${processNumber}? O status passará para CANCELADO.`,
      )
    ) {
      return;
    }
    setBusy("cancel");
    setError(null);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus: "CANCELADO",
          reason: "Cancelado pela listagem de processos",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha ao cancelar");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de conexão");
    } finally {
      setBusy(null);
    }
  }

  async function deleteProcess() {
    if (
      !window.confirm(
        `Excluir permanentemente ${processNumber}? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/v1/processes/${processId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Falha ao excluir");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de conexão");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        <Link
          href={`/processes/${processId}`}
          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
        >
          Abrir
        </Link>
        {canWrite ? (
          <Link
            href={`/processes/${processId}/edit`}
            className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            Editar
          </Link>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void cancelProcess()}
            className="rounded border border-amber-200 px-2 py-1 text-xs text-amber-800 hover:bg-amber-50 disabled:opacity-50"
          >
            {busy === "cancel" ? "…" : "Cancelar"}
          </button>
        ) : null}
        {canHardDelete ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void deleteProcess()}
            className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            {busy === "delete" ? "…" : "Excluir"}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="max-w-[16rem] text-right text-[11px] text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
