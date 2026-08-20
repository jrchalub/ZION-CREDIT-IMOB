import { describe, expect, it } from "vitest";
import { classifyAgingDays } from "./aging";
import {
  eventForStatusTransition,
  OPERATIONAL_STAGE_LABELS,
  toOperationalStage,
} from "./operational-stages";

describe("operational workflow mapping", () => {
  it("maps process statuses to operational stages", () => {
    expect(toOperationalStage("NOVO")).toBe("NOVO");
    expect(toOperationalStage("DOCUMENTACAO_PENDENTE")).toBe(
      "AGUARDANDO_DOCUMENTOS",
    );
    expect(toOperationalStage("PRE_ANALISADO")).toBe("DOSSIE_PRONTO");
    expect(toOperationalStage("ENVIADO_AO_BANCO")).toBe(
      "ENVIADO_PARA_INSTITUICAO",
    );
    expect(toOperationalStage("APROVADO")).toBe("APROVADO");
    expect(OPERATIONAL_STAGE_LABELS.APROVADO).toContain("instituição");
  });

  it("maps transitions to notification events", () => {
    expect(eventForStatusTransition("DOCUMENTACAO_PENDENTE")).toBe(
      "DOCUMENT_REQUIRED",
    );
    expect(eventForStatusTransition("PRE_ANALISADO")).toBe("DOSSIER_READY");
    expect(eventForStatusTransition("APROVADO")).toBe("DECISION_UPDATED");
  });

  it("classifies aging buckets", () => {
    expect(classifyAgingDays(1)).toBe("d0_2");
    expect(classifyAgingDays(4)).toBe("d3_5");
    expect(classifyAgingDays(8)).toBe("d6_10");
    expect(classifyAgingDays(12)).toBe("d10plus");
  });
});
