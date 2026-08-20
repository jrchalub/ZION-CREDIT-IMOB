import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  getAllowedTransitions,
} from "./status-machine";

describe("process status machine", () => {
  it("allows NOVO → DOCUMENTACAO_PENDENTE", () => {
    expect(canTransition("NOVO", "DOCUMENTACAO_PENDENTE")).toBe(true);
  });

  it("blocks invalid jumps", () => {
    expect(canTransition("NOVO", "CONTRATADO")).toBe(false);
    expect(canTransition("CANCELADO", "NOVO")).toBe(false);
  });

  it("throws on invalid assert", () => {
    expect(() => assertTransition("CONTRATADO", "NOVO")).toThrow(/inválida/);
  });

  it("returns allowed transitions", () => {
    expect(getAllowedTransitions("APROVADO")).toEqual(["CONTRATADO", "CANCELADO"]);
  });
});
