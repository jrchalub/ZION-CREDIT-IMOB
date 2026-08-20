import { describe, expect, it } from "vitest";
import {
  buildExplainableFactors,
  buildFactorMatrix,
  deriveIndicative,
} from "./buildExplainableFactors";
import {
  buildDecisionSupportPayload,
  hashDecisionSupportPayload,
} from "../snapshot/DecisionSupportSnapshot";

describe("explainable decision factors", () => {
  it("attaches provenance to income recurrence factor", () => {
    const factors = buildExplainableFactors({
      financialSnapshotId: "fs-12345678-aaaa",
      financialPayload: {
        statements: [
          { yearMonth: "2026-04", validCredits: 4800 },
          { yearMonth: "2026-05", validCredits: 4950 },
          { yearMonth: "2026-06", validCredits: 5100 },
        ],
        commitmentPct: 25,
        flags: [],
        commitments: { cards: 200, debts: 0 },
        declaredIncome: 2550,
        analyzedIncome: 4950,
      },
      documentationPct: 100,
      consistencyScore: 94,
      consistencyFactors: [{ label: "CPF consistente", positive: true }],
      consistencyIssues: [],
      openPendencies: [],
      declaredIncome: 2550,
      analyzedIncome: 4950,
    });

    const income = factors.find((f) => f.code === "INCOME_CONSISTENCY");
    expect(income).toBeTruthy();
    expect(income!.originType).toBe("financial_snapshot");
    expect(income!.originId).toBe("fs-12345678-aaaa");
    expect(income!.evidence.financialSnapshotId).toBe("fs-12345678-aaaa");

    const divergence = factors.find(
      (f) => f.code === "DECLARED_BANKING_INCOME_DIVERGENCE",
    );
    expect(divergence).toBeTruthy();
    expect(divergence!.kind).toBe("ATENCAO");
  });

  it("maps address pendency to document origin", () => {
    const factors = buildExplainableFactors({
      financialSnapshotId: null,
      financialPayload: null,
      documentationPct: 80,
      consistencyScore: null,
      consistencyFactors: [],
      consistencyIssues: [],
      openPendencies: [
        {
          id: "pend-1",
          type: "ADDRESS_DOCUMENT_REVIEW",
          description: "Comprovante de endereço necessita validação humana.",
          documentId: "doc-128",
        },
      ],
      declaredIncome: null,
      analyzedIncome: null,
    });

    const p = factors.find((f) => f.code === "PENDENCY_ADDRESS_DOCUMENT_REVIEW");
    expect(p!.kind).toBe("PENDENCIA");
    expect(p!.evidence.documentId).toBe("doc-128");
    expect(p!.originLabel).toContain("Document");
  });

  it("builds matrix without numeric score and derives REQUER_ANALISE", () => {
    const factors = buildExplainableFactors({
      financialSnapshotId: "fs-1",
      financialPayload: {
        statements: [{ yearMonth: "2026-05", validCredits: 4950 }],
        commitmentPct: 35,
        flags: ["FEW_STATEMENT_MONTHS"],
        commitments: { cards: 0, debts: 0 },
      },
      documentationPct: 100,
      consistencyScore: 90,
      consistencyFactors: [],
      consistencyIssues: [],
      openPendencies: [],
      declaredIncome: 2550,
      analyzedIncome: 4950,
    });

    const matrix = buildFactorMatrix(factors);
    expect(matrix.some((m) => m.category === "Comprometimento")).toBe(true);
    expect(matrix.every((m) => ["OK", "ATENCAO", "CRITICO", "NA"].includes(m.result))).toBe(
      true,
    );

    const indicative = deriveIndicative(matrix, factors);
    expect(indicative).toBe("REQUER_ANALISE");
  });

  it("snapshot hash is deterministic and versioned", () => {
    const factors = buildExplainableFactors({
      financialSnapshotId: "fs-1",
      financialPayload: {
        statements: [
          { yearMonth: "2026-04", validCredits: 4800 },
          { yearMonth: "2026-05", validCredits: 4950 },
          { yearMonth: "2026-06", validCredits: 5100 },
        ],
        commitmentPct: 22,
        flags: [],
        commitments: { cards: 0, debts: 0 },
      },
      documentationPct: 100,
      consistencyScore: 94,
      consistencyFactors: [{ label: "Nome consistente", positive: true }],
      consistencyIssues: [],
      openPendencies: [],
      declaredIncome: 2550,
      analyzedIncome: 4950,
    });
    const matrix = buildFactorMatrix(factors);
    const indicative = deriveIndicative(matrix, factors);

    const payload = buildDecisionSupportPayload({
      processId: "p1",
      processNumber: "PF-2026-000001",
      financialSnapshotId: "fs-1",
      indicativeResult: indicative,
      matrix,
      factors,
      summary: {
        documentationPct: 100,
        consistencyScore: 94,
        openPendencies: 0,
        declaredIncome: 2550,
        analyzedIncome: 4950,
        commitmentPct: 22,
      },
      executedAt: new Date("2026-08-20T18:00:00.000Z"),
    });

    expect(payload.rulesVersion).toBe("credit-support-v1");
    expect(payload.autoApprovalDisabled).toBe(true);
    expect(hashDecisionSupportPayload(payload)).toBe(
      hashDecisionSupportPayload(payload),
    );
  });
});
