export type BoundingBox = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type ClassificationInput = {
  text: string;
  mimeType: string;
  filename: string;
  knownTypeCodes: string[];
};

export type ClassificationResult = {
  documentType: string;
  confidence: number;
  provider: string;
  model?: string;
  promptVersion: string;
};

export type ExtractedField = {
  field: string;
  value: string | null;
  normalizedValue?: string | null;
  confidence: number;
  page?: number | null;
  evidenceText?: string | null;
  boundingBox?: BoundingBox | null;
};

export type ExtractionInput = {
  text: string;
  documentType: string;
  mimeType: string;
  filename: string;
};

export type ExtractionResult = {
  fields: ExtractedField[];
  /** Structured extras (e.g. bank transactions) — not income analysis */
  extras?: Record<string, unknown>;
  provider: string;
  model?: string;
  promptVersion: string;
};

export type AnalysisInput = {
  text: string;
  documentType: string;
};

export type AnalysisResult = {
  summary: string;
  flags: string[];
  provider: string;
  model?: string;
  promptVersion: string;
};

/**
 * Abstract Document AI provider.
 * Controllers/workers must never call OpenAI (or any vendor) directly.
 */
export interface DocumentAIProvider {
  readonly name: string;
  classify(input: ClassificationInput): Promise<ClassificationResult>;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
  analyze?(input: AnalysisInput): Promise<AnalysisResult>;
}

export type MockAiScenario =
  | "SUCCESS"
  | "LOW_CONFIDENCE"
  | "NAME_MISMATCH"
  | "CPF_MISMATCH"
  | "INVALID_JSON"
  | "PROVIDER_ERROR"
  | "OCR_ERROR";
