import { describe, expect, it } from "vitest";
import { classifyTransaction } from "./rules-v1";

describe("transaction classifier rules-v1", () => {
  it("classifies salary credits", () => {
    const r = classifyTransaction({
      description: "Pagamento de salario FOLHA",
      direction: "CREDIT",
    });
    expect(r.category).toBe("SALARY");
    expect(r.confidence).toBeGreaterThan(0.9);
  });

  it("classifies own transfers", () => {
    const r = classifyTransaction({
      description: "Transferencia propria entre contas",
      direction: "CREDIT",
    });
    expect(r.category).toBe("OWN_TRANSFER");
  });

  it("classifies loans", () => {
    const r = classifyTransaction({
      description: "Credito pessoal - emprestimo liberado",
      direction: "CREDIT",
    });
    expect(r.category).toBe("LOAN");
  });

  it("classifies refunds", () => {
    const r = classifyTransaction({
      description: "Estorno compra loja",
      direction: "CREDIT",
    });
    expect(r.category).toBe("REFUND");
  });

  it("classifies card payments", () => {
    const r = classifyTransaction({
      description: "Pagamento fatura Midway",
      direction: "DEBIT",
    });
    expect(r.category).toBe("CARD_PAYMENT");
  });
});
