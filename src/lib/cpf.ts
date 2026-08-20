/**
 * CPF utilities — validation and masking for LGPD-safe handling.
 * Never log full CPF values.
 */

export function stripCpf(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCpf(value: string): string {
  const digits = stripCpf(value);
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** Masks CPF for display/logs: ***.XXX.XXX-** */
export function maskCpf(value: string): string {
  const digits = stripCpf(value);
  if (digits.length !== 11) return "***";
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

function calcCheckDigit(base: string, factor: number): number {
  let sum = 0;
  for (let i = 0; i < base.length; i += 1) {
    sum += Number(base[i]) * (factor - i);
  }
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function isValidCpf(value: string): boolean {
  const digits = stripCpf(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const d1 = calcCheckDigit(digits.slice(0, 9), 10);
  if (d1 !== Number(digits[9])) return false;

  const d2 = calcCheckDigit(digits.slice(0, 10), 11);
  return d2 === Number(digits[10]);
}
