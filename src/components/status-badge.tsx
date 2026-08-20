import { PROCESS_STATUS_LABELS, type ProcessStatus } from "@/domain/process/status-machine";
import { cn } from "@/lib/utils";

const TONES: Partial<Record<ProcessStatus, string>> = {
  NOVO: "bg-sky-100 text-sky-800",
  EM_ANALISE: "bg-amber-100 text-amber-900",
  EM_TRIAGEM: "bg-amber-100 text-amber-900",
  DOCUMENTACAO_PENDENTE: "bg-orange-100 text-orange-900",
  PENDENCIA_ANALISTA: "bg-orange-100 text-orange-900",
  APTO: "bg-emerald-100 text-emerald-900",
  PRE_ANALISADO: "bg-emerald-50 text-emerald-800",
  NAO_APTO: "bg-rose-100 text-rose-900",
  REPROVADO: "bg-rose-100 text-rose-900",
  APROVADO: "bg-teal-100 text-teal-900",
  CONTRATADO: "bg-teal-200 text-teal-950",
  CANCELADO: "bg-slate-200 text-slate-700",
  ENVIADO_AO_BANCO: "bg-indigo-100 text-indigo-900",
};

export function StatusBadge({ status }: { status: ProcessStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded px-2 py-0.5 text-xs font-medium",
        TONES[status] ?? "bg-slate-100 text-slate-700",
      )}
    >
      {PROCESS_STATUS_LABELS[status]}
    </span>
  );
}
