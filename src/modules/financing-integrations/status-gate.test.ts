import { describe, expect, it } from "vitest";
import { canSubmitFinancing } from "./status-gate";
import type { ProcessStatus } from "@/domain/process/status-machine";

describe("financing status gate", () => {
  it("allows APTO, AGUARDANDO_BANCO and ENVIADO_AO_BANCO (re-submit)", () => {
    expect(canSubmitFinancing("APTO")).toBe(true);
    expect(canSubmitFinancing("AGUARDANDO_BANCO")).toBe(true);
    expect(canSubmitFinancing("ENVIADO_AO_BANCO")).toBe(true);
  });

  it("blocks earlier and terminal statuses", () => {
    const blocked: ProcessStatus[] = [
      "NOVO",
      "EM_ANALISE",
      "PRE_ANALISADO",
      "APROVADO",
      "CANCELADO",
    ];
    for (const status of blocked) {
      expect(canSubmitFinancing(status)).toBe(false);
    }
  });
});
