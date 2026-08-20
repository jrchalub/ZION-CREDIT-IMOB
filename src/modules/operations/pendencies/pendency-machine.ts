/** FASE 6.4 — self-service pendency lifecycle (pure, no DB). */

export const PENDENCY_STATUSES = [
  "OPEN",
  "SUBMITTED",
  "UNDER_REVIEW",
  "RESOLVED",
  "REJECTED",
  "CANCELLED",
] as const;

export type PendencyStatus = (typeof PENDENCY_STATUSES)[number];

export const PENDENCY_STATUS_LABELS: Record<PendencyStatus, string> = {
  OPEN: "Aberta",
  SUBMITTED: "Enviada pelo cliente",
  UNDER_REVIEW: "Em revisão",
  RESOLVED: "Resolvida",
  REJECTED: "Rejeitada",
  CANCELLED: "Cancelada",
};

/** Still actionable for client / ops queues */
export const OPEN_PENDENCY_STATUSES: readonly PendencyStatus[] = [
  "OPEN",
  "SUBMITTED",
  "UNDER_REVIEW",
  "REJECTED",
];

export const TERMINAL_PENDENCY_STATUSES: readonly PendencyStatus[] = [
  "RESOLVED",
  "CANCELLED",
];

const ALLOWED: Record<PendencyStatus, readonly PendencyStatus[]> = {
  OPEN: ["SUBMITTED", "UNDER_REVIEW", "RESOLVED", "CANCELLED"],
  SUBMITTED: ["UNDER_REVIEW", "RESOLVED", "REJECTED", "CANCELLED"],
  UNDER_REVIEW: ["RESOLVED", "REJECTED", "CANCELLED", "SUBMITTED"],
  REJECTED: ["SUBMITTED", "CANCELLED", "UNDER_REVIEW"],
  RESOLVED: [],
  CANCELLED: [],
};

export function assertPendencyTransition(
  from: PendencyStatus,
  to: PendencyStatus,
): void {
  if (from === to) return;
  if (!ALLOWED[from]?.includes(to)) {
    throw new Error(`Transição de pendência inválida: ${from} → ${to}`);
  }
}

export function isOpenPendencyStatus(status: string): boolean {
  return (OPEN_PENDENCY_STATUSES as readonly string[]).includes(status);
}
