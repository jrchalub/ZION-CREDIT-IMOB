import { createHash } from "node:crypto";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { AppError } from "@/lib/api";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_EXT = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);

export function getMaxUploadBytes() {
  return Number(process.env.MAX_UPLOAD_BYTES ?? 20 * 1024 * 1024);
}

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function sanitizeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^\w.\-()\sÀ-ÿ]/g, "_");
  return base.slice(0, 180) || "documento";
}

export function getExtension(filename: string): string {
  const ext = path.extname(filename).replace(".", "").toLowerCase();
  return ext;
}

export async function validateUploadBuffer(input: {
  filename: string;
  declaredMime: string;
  buffer: Buffer;
}) {
  const max = getMaxUploadBytes();
  if (input.buffer.length === 0) {
    throw new AppError(400, "Arquivo vazio", "EMPTY_FILE");
  }
  if (input.buffer.length > max) {
    throw new AppError(400, "Arquivo excede o tamanho máximo permitido", "FILE_TOO_LARGE");
  }

  const ext = getExtension(input.filename);
  if (!ALLOWED_EXT.has(ext)) {
    throw new AppError(400, "Extensão de arquivo não permitida", "INVALID_EXTENSION");
  }

  const detected = await fileTypeFromBuffer(input.buffer);
  const mime = detected?.mime ?? input.declaredMime;
  if (!ALLOWED_MIME.has(mime)) {
    throw new AppError(400, "Tipo MIME não permitido", "INVALID_MIME");
  }

  // Block obvious path traversal / executable names
  if (
    input.filename.includes("..") ||
    input.filename.includes("/") ||
    input.filename.includes("\\")
  ) {
    throw new AppError(400, "Nome de arquivo inválido", "INVALID_FILENAME");
  }

  return {
    mimeType: mime,
    extension: detected?.ext ?? ext,
    sizeBytes: input.buffer.length,
    contentHash: sha256(input.buffer),
    originalFilename: sanitizeFilename(input.filename),
  };
}

export function buildStorageKey(input: {
  tenantId: string;
  processId: string;
  documentId: string;
  extension: string;
}) {
  // Private object key — never expose under /public
  return `tenants/${input.tenantId}/processes/${input.processId}/documents/${input.documentId}.${input.extension}`;
}
