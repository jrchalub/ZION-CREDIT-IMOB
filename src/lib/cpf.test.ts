import { describe, expect, it } from "vitest";
import { formatCpf, isValidCpf, maskCpf, stripCpf } from "./cpf";

describe("cpf", () => {
  it("strips non-digits", () => {
    expect(stripCpf("529.982.247-25")).toBe("52998224725");
  });

  it("validates check digits", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("529.982.247-24")).toBe(false);
  });

  it("formats and masks safely", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCpf("52998224725")).toBe("***.982.247-**");
  });
});
