/** Last N complete calendar months (excludes the current month). */
export function referenceMonths(n: number, asOf = new Date()): string[] {
  const months: string[] = [];
  for (let i = n; i >= 1; i -= 1) {
    const d = new Date(asOf.getFullYear(), asOf.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }
  return months;
}

export function competenceFromPeriod(value: string | null | undefined): string | null {
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const br = value.match(/^(\d{2})\/(\d{4})$/);
  if (br) return `${br[2]}-${br[1]}`;
  const brFull = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brFull) return `${brFull[3]}-${brFull[2]}`;
  return null;
}

export function monthLabelPt(competence: string): string {
  const [year, month] = competence.split("-");
  const names = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const idx = Number(month) - 1;
  const name = names[idx] ?? month;
  return `${name}/${year}`;
}

export type MonthCoverage = {
  competence: string;
  label: string;
  present: boolean;
};

export function monthCoverage(
  required: string[],
  present: string[],
): { months: MonthCoverage[]; complete: boolean; missing: string[] } {
  const set = new Set(present);
  const months = required.map((competence) => ({
    competence,
    label: monthLabelPt(competence),
    present: set.has(competence),
  }));
  const missing = months.filter((m) => !m.present).map((m) => m.competence);
  return { months, complete: missing.length === 0, missing };
}
