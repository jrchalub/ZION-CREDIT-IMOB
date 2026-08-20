export type ChecklistItemStatus =
  | "PENDENTE"
  | "ENVIADO"
  | "VALIDADO"
  | "REJEITADO"
  | "NAO_APLICAVEL";

const INACTIVE_DOCUMENT_STATUSES = new Set(["REJEITADO", "EXPIRADO"]);

/**
 * Aggregates per-file document statuses into the parent checklist item.
 * Inactive files (rejected/expired) do not block a healthy annex.
 */
export function deriveChecklistStatusFromDocuments(
  documentStatuses: string[],
): Exclude<ChecklistItemStatus, "NAO_APLICAVEL"> {
  if (documentStatuses.length === 0) return "PENDENTE";

  const active = documentStatuses.filter(
    (status) => !INACTIVE_DOCUMENT_STATUSES.has(status),
  );
  if (active.length === 0) return "REJEITADO";
  if (active.every((status) => status === "VALIDADO")) return "VALIDADO";
  return "ENVIADO";
}
