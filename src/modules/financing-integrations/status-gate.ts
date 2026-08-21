import type { ProcessStatus } from "@/domain/process/status-machine";

/** Allow re-submit to another banking correspondent after first institutional send. */
const SUBMIT_ALLOWED_STATUSES: ProcessStatus[] = [
  "APTO",
  "AGUARDANDO_BANCO",
  "ENVIADO_AO_BANCO",
];

export function canSubmitFinancing(status: ProcessStatus): boolean {
  return SUBMIT_ALLOWED_STATUSES.includes(status);
}
