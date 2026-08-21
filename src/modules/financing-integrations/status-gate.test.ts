import { describe, expect, it } from "vitest";
import { canSubmitFinancing } from "./status-gate";
import type { ProcessStatus } from "@/domain/process/status-machine";

describe("financing status gate", () => {
  it("allows APTO and AGUARDANDO_BANCO", () => {
    expect(canSubmitFinancing("APTO")).toBe(true);
    expect(canSubmitFinancing("AGUARDANDO_BANCO")).toBe(true);
  });

  it("blocks earlier and terminal statuses", () => {
    const blocked: ProcessStatus[] = [
      "NOVO",
      "EM_ANALISE",
      "PRE_ANALISADO",
      "ENVIADO_AO_BANCO",
      "APROVADO",
      "CANCELADO",
    ];
    for (const status of blocked) {
      expect(canSubmitFinancing(status)).toBe(false);
    }
  });
});
