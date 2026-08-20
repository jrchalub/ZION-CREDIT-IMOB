import { describe, expect, it } from "vitest";

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

describe("consistency name normalization", () => {
  it("treats accented names as equal", () => {
    expect(normalizeName("Ana Paula Martins Santos")).toBe(
      normalizeName("ANA PAULA MARTINS SANTOS"),
    );
    expect(normalizeName("São Paulo")).toBe(normalizeName("Sao Paulo"));
  });

  it("detects name mismatch", () => {
    expect(normalizeName("Ana Paula Silva")).not.toBe(
      normalizeName("Ana Paula Martins Santos"),
    );
  });
});
