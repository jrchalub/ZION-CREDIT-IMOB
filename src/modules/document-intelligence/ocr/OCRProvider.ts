export type OCRInput = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
};

export type OCRResult = {
  text: string;
  pages: number;
  confidence: number;
  provider: string;
  providerVersion: string;
  processingTimeMs: number;
  method: "native_text" | "ocr";
};

export interface OCRProvider {
  readonly name: string;
  extractText(input: OCRInput): Promise<OCRResult>;
}
