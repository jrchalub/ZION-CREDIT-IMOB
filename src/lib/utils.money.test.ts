import { describe, expect, it } from "vitest";
import { toNumericMoneyString } from "./utils";

describe("toNumericMoneyString", () => {
  it("accepts plain and decimal", () => {
    expect(toNumericMoneyString("320000")).toBe("320000.00");
    expect(toNumericMoneyString("320000.50")).toBe("320000.50");
    expect(toNumericMoneyString(15000)).toBe("15000.00");
  });

  it("accepts pt-BR formats", () => {
    expect(toNumericMoneyString("320.000,00")).toBe("320000.00");
    expect(toNumericMoneyString("R$ 15.000,50")).toBe("15000.50");
    expect(toNumericMoneyString("1.234")).toBe("1234.00");
  });

  it("returns null for empty", () => {
    expect(toNumericMoneyString("")).toBeNull();
    expect(toNumericMoneyString(null)).toBeNull();
    expect(toNumericMoneyString(undefined)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(() => toNumericMoneyString("abc")).toThrow();
    expect(() => toNumericMoneyString("R$")).toThrow();
  });
});
