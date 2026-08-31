import type { OCRProvider } from "./OCRProvider";
import { MockOCRProvider } from "./MockOCRProvider";
import { OpenAIOCRProvider } from "./OpenAIOCRProvider";
import { resolveOcrProviderName } from "./ocr-provider-select";

export function getOCRProvider(): OCRProvider {
  const name = resolveOcrProviderName({
    ocrProvider: process.env.OCR_PROVIDER,
    aiProvider: process.env.AI_PROVIDER,
  });
  if (name === "openai") return new OpenAIOCRProvider();
  return new MockOCRProvider();
}

export { MockOCRProvider, extractNativePdfText } from "./MockOCRProvider";
export { OpenAIOCRProvider } from "./OpenAIOCRProvider";
