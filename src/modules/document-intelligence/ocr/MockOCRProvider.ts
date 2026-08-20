import type { OCRInput, OCRProvider, OCRResult } from "./OCRProvider";

/**
 * Native text extraction for PDFs that already contain text.
 * Avoids unnecessary OCR cost.
 */
export async function extractNativePdfText(
  buffer: Buffer,
): Promise<{ text: string; usable: boolean; pages: number }> {
  const raw = buffer.toString("latin1");
  // Heuristic: look for readable streams / common text markers without full PDF parser
  const textMatches = raw.match(/\((?:\\.|[^\\)]){3,}\)/g) ?? [];
  const decoded = textMatches
    .map((m) => m.slice(1, -1).replace(/\\([nrt()\\])/g, "$1"))
    .filter((t) => /[A-Za-zÀ-ÿ0-9]{3,}/.test(t))
    .join("\n");

  const usable = decoded.replace(/\s+/g, " ").trim().length >= 40;
  const pageMarkers = raw.match(/\/Type\s*\/Page[^s]/g) ?? [];
  return {
    text: decoded,
    usable,
    pages: Math.max(1, pageMarkers.length || 1),
  };
}

export class MockOCRProvider implements OCRProvider {
  readonly name = "mock-ocr";

  async extractText(input: OCRInput): Promise<OCRResult> {
    const started = Date.now();
    const lower = input.filename.toLowerCase();
    if (
      lower.includes("ocrerror") ||
      process.env.MOCK_AI_SCENARIO === "OCR_ERROR"
    ) {
      throw new Error("MOCK_OCR_ERROR");
    }

    if (input.mimeType === "application/pdf") {
      const native = await extractNativePdfText(input.buffer);
      if (native.usable) {
        return {
          text: native.text,
          pages: native.pages,
          confidence: 0.99,
          provider: this.name,
          providerVersion: "native-v1",
          processingTimeMs: Date.now() - started,
          method: "native_text",
        };
      }
    }

    // Simulated OCR for images / scanned PDFs
    const text = [
      "Ana Paula Martins Santos",
      "CPF 529.982.247-25",
      "Documento processado via OCR mock",
      `Arquivo: ${input.filename}`,
    ].join("\n");

    return {
      text,
      pages: 1,
      confidence: 0.91,
      provider: this.name,
      providerVersion: "ocr-mock-v1",
      processingTimeMs: Date.now() - started,
      method: "ocr",
    };
  }
}

export function getOCRProvider(): OCRProvider {
  return new MockOCRProvider();
}
