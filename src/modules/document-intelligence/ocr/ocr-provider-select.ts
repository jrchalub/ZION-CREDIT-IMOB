export function resolveOcrProviderName(input: {
  ocrProvider?: string | null;
  aiProvider?: string | null;
}): "openai" | "mock" {
  const ocr = (input.ocrProvider ?? "").toLowerCase().trim();
  if (ocr === "openai") return "openai";
  if (ocr === "mock") return "mock";
  const ai = (input.aiProvider ?? "mock").toLowerCase().trim();
  return ai === "openai" ? "openai" : "mock";
}

export function visionMimeFromDocument(mimeType: string): string | null {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "image/jpeg";
  if (mimeType === "image/png") return "image/png";
  if (mimeType === "image/webp") return "image/webp";
  return null;
}
