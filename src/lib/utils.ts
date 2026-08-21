import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

/**
 * Normalize money input (pt-BR or plain) into a Postgres `numeric` string.
 * Returns null for empty; throws Error for unparseable values.
 */
export function toNumericMoneyString(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Valor monetário inválido");
    }
    return value.toFixed(2);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  let normalized = trimmed
    .replace(/R\$\s?/gi, "")
    .replace(/\s/g, "")
    .replace(/[^\d.,-]/g, "");

  if (!normalized || normalized === "-" || normalized === "." || normalized === ",") {
    throw new Error("Valor monetário inválido");
  }

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    // 1.234.567,89 (pt-BR)
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // 1234,56
    normalized = normalized.replace(",", ".");
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    // 1.234 or 1.234.567 (thousands, no decimals)
    normalized = normalized.replace(/\./g, "");
  }

  const num = Number(normalized);
  if (!Number.isFinite(num)) {
    throw new Error("Valor monetário inválido");
  }
  return num.toFixed(2);
}

export function formatCpfDisplay(cpf: string) {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
