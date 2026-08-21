import { AppError } from "@/lib/api";

export type ValidityWindow = {
  documentDate: string;
  validUntil: string;
  expired: boolean;
  validityDays: number;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseCalendarDate(value: string): string | null {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const br = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const match = iso ?? br;
  if (!match) return null;
  const year = Number(iso ? match[1] : match[3]);
  const month = Number(iso ? match[2] : match[2]);
  const day = Number(iso ? match[3] : match[1]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return toIsoDate(date);
}

export function addCalendarDays(isoDate: string, days: number) {
  const parsed = parseCalendarDate(isoDate);
  if (!parsed) return null;
  const [year, month, day] = parsed.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function isExpiredOn(validUntil: string | Date, asOf = new Date()) {
  const iso =
    validUntil instanceof Date ? toIsoDate(validUntil) : validUntil.slice(0, 10);
  return toIsoDate(asOf) > iso;
}

export function computeValidityWindow(input: {
  documentDate: string;
  validityDays: number;
  asOf?: Date;
}): ValidityWindow {
  const documentDate = parseCalendarDate(input.documentDate);
  if (!documentDate) {
    throw new AppError(
      400,
      "Data do documento inválida. Use AAAA-MM-DD.",
      "INVALID_DOCUMENT_DATE",
    );
  }
  const today = toIsoDate(input.asOf ?? new Date());
  if (documentDate > today) {
    throw new AppError(
      400,
      "A data do comprovante não pode ser futura.",
      "FUTURE_DOCUMENT_DATE",
    );
  }
  const validUntil = addCalendarDays(documentDate, input.validityDays);
  if (!validUntil) {
    throw new AppError(400, "Data do documento inválida.", "INVALID_DOCUMENT_DATE");
  }
  return {
    documentDate,
    validUntil,
    expired: isExpiredOn(validUntil, input.asOf),
    validityDays: input.validityDays,
  };
}

const DATE_FIELDS = [
  "document_date",
  "issue_date",
  "competence_date",
  "period_end",
  "competence",
];

export function extractDocumentDateFromFields(
  fields: Array<{ field: string; value: string | null }>,
) {
  for (const name of DATE_FIELDS) {
    const value = fields.find((field) => field.field === name)?.value;
    if (!value) continue;
    if (/^\d{4}-\d{2}$/.test(value)) {
      const [year, month] = value.split("-").map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      return parseCalendarDate(
        `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      );
    }
    const parsed = parseCalendarDate(value);
    if (parsed) return parsed;
  }
  return null;
}
