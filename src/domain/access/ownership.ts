import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";

export function isCorrespondentRole(session: SessionPayload): boolean {
  return session.role === "CORRESPONDENTE";
}

export function assertProcessOwnedBySession(
  session: SessionPayload,
  process: {
    tenantId: string;
    correspondentId: string | null;
    createdByUserId: string | null;
  },
) {
  if (process.tenantId !== session.tenantId) {
    throw new AppError(404, "Processo não encontrado", "PROCESS_NOT_FOUND");
  }

  if (!isCorrespondentRole(session)) return;

  if (session.correspondentId) {
    if (process.correspondentId !== session.correspondentId) {
      throw new AppError(404, "Processo não encontrado", "PROCESS_NOT_FOUND");
    }
    return;
  }

  if (process.createdByUserId !== session.sub) {
    throw new AppError(404, "Processo não encontrado", "PROCESS_NOT_FOUND");
  }
}
