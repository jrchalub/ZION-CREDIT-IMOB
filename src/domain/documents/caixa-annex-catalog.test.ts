import { describe, expect, it } from "vitest";
import {
  CAIXA_ANNEXES,
  annexLabel,
  getAnnexByCode,
} from "./caixa-annex-catalog";

describe("CAIXA_ANNEXES", () => {
  it("defines 12 unique annexes with stable codes", () => {
    expect(CAIXA_ANNEXES).toHaveLength(12);
    expect(CAIXA_ANNEXES.map((a) => a.annexNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(new Set(CAIXA_ANNEXES.map((a) => a.code)).size).toBe(12);
  });

  it("reuses identity codes already present in production data", () => {
    expect(getAnnexByCode("RG_CPF")?.annexNumber).toBe(2);
    expect(getAnnexByCode("CERTIDAO_ESTADO_CIVIL")?.annexNumber).toBe(3);
    expect(getAnnexByCode("COMPROVANTE_ENDERECO")?.validityDays).toBe(60);
    expect(getAnnexByCode("CTPS_DIGITAL")?.annexNumber).toBe(9);
  });

  it("labels annexes for the process checklist", () => {
    expect(annexLabel(CAIXA_ANNEXES[0])).toBe(
      "Anexo 1 — Simulação de Financiamento Caixa",
    );
  });

  it("explains multi-file uploads for renda, CTPS and outros", () => {
    expect(getAnnexByCode("COMPROVANTE_RENDA")?.multipleHint).toMatch(/mesmo anexo/);
    expect(getAnnexByCode("CTPS_DIGITAL")?.multipleHint).toMatch(/física e a Digital/);
    expect(getAnnexByCode("OUTROS_DOCUMENTOS")?.multipleHint).toMatch(/auxiliares/);
  });
});
