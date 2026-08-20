/** Pure aging helpers — no DB imports (safe for unit tests). */
export function classifyAgingDays(
  ageDays: number,
): "d0_2" | "d3_5" | "d6_10" | "d10plus" {
  if (ageDays <= 2) return "d0_2";
  if (ageDays <= 5) return "d3_5";
  if (ageDays <= 10) return "d6_10";
  return "d10plus";
}
