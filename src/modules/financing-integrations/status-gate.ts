import type { ProcessStatus } from "@/domain/process/status-machine";

const SUBMIT_ALLOWED_STATUSES: ProcessStatus[] = ["APTO", "AGUARDANDO_BANCO"];

export function canSubmitFinancing(status: ProcessStatus): boolean {
  return SUBMIT_ALLOWED_STATUSES.includes(status);
}
