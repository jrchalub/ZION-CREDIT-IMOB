import { describe, expect, it } from "vitest";
import { MockDocumentAIProvider } from "../providers/MockDocumentAIProvider";
import {
  classificationResultSchema,
  extractionResultSchema,
  mapToKnownTypeCode,
} from "../schemas/classification";

describe("MockDocumentAIProvider scenarios", () => {
  const known = [
    "RG_CPF",
    "EXTRATO_BANCARIO",
    "COMPROVANTE_ENDERECO",
    "CTPS_DIGITAL",
  ];

  it("SUCCESS returns high confidence classification", async () => {
    const ai = new MockDocumentAIProvider("SUCCESS");
    const result = await ai.classify({
      text: "teste",
      mimeType: "application/pdf",
      filename: "extrato-maio.pdf",
      knownTypeCodes: known,
    });
    expect(classificationResultSchema.parse(result).confidence).toBeGreaterThanOrEqual(
      0.9,
    );
    expect(result.documentType).toBe("EXTRATO_BANCARIO");
  });

  it("LOW_CONFIDENCE returns below review threshold", async () => {
    const ai = new MockDocumentAIProvider("LOW_CONFIDENCE");
    const result = await ai.classify({
      text: "x",
      mimeType: "application/pdf",
      filename: "doc.pdf",
      knownTypeCodes: known,
    });
    expect(result.confidence).toBeLessThan(0.7);
  });

  it("NAME_MISMATCH extracts diverging name with evidence", async () => {
    const ai = new MockDocumentAIProvider("NAME_MISMATCH");
    const result = await ai.extract({
      text: "x",
      documentType: "RG_CPF",
      mimeType: "application/pdf",
      filename: "rg.pdf",
    });
    const parsed = extractionResultSchema.parse(result);
    const name = parsed.fields.find((f) => f.field === "full_name");
    expect(name?.value).toBe("Ana Paula Silva");
    expect(name?.evidenceText).toBeTruthy();
    expect(name?.page).toBe(1);
  });

  it("PROVIDER_ERROR throws", async () => {
    const ai = new MockDocumentAIProvider("PROVIDER_ERROR");
    await expect(
      ai.classify({
        text: "x",
        mimeType: "application/pdf",
        filename: "x.pdf",
        knownTypeCodes: known,
      }),
    ).rejects.toThrow("MOCK_PROVIDER_ERROR");
  });

  it("maps aliases to known codes", () => {
    expect(mapToKnownTypeCode("BANK_STATEMENT", known)).toBe("EXTRATO_BANCARIO");
    expect(mapToKnownTypeCode("__INVALID__", known)).toBeNull();
  });
});
