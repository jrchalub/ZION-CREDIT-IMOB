import type { OCRInput, OCRProvider, OCRResult } from "./OCRProvider";
import { MockOCRProvider, extractNativePdfText } from "./MockOCRProvider";
import { PROMPT_VERSIONS } from "../prompts/versions";
import { visionMimeFromDocument } from "./ocr-provider-select";
import {
  getOpenAICompatApiKey,
  getOpenAICompatOcrModel,
  openAICompatChatCompletion,
  parseJsonFromModelContent,
} from "../providers/openai-compat";

/**
 * Vision OCR via OpenAI-compatible API (OpenAI / OpenRouter).
 * Native PDF text still preferred (no cost).
 */
export class OpenAIOCRProvider implements OCRProvider {
  readonly name = "openai-ocr";
  private readonly fallback = new MockOCRProvider();

  private get apiKey() {
    return getOpenAICompatApiKey();
  }

  private get model() {
    return getOpenAICompatOcrModel();
  }

  async extractText(input: OCRInput): Promise<OCRResult> {
    if (!this.apiKey) {
      const mock = await this.fallback.extractText(input);
      return { ...mock, provider: `${this.name}+mock-fallback` };
    }

    const started = Date.now();

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
      return {
        text: "",
        pages: native.pages,
        confidence: 0,
        provider: this.name,
        providerVersion: "scanned-pdf-needs-review",
        processingTimeMs: Date.now() - started,
        method: "ocr",
      };
    }

    const visionMime = visionMimeFromDocument(input.mimeType);
    if (!visionMime) {
      return this.fallback.extractText(input);
    }

    const dataUrl = `data:${visionMime};base64,${input.buffer.toString("base64")}`;
    const { content } = await openAICompatChatCompletion({
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            "Transcribe all readable text from this Brazilian identity/financial document. Return JSON {text, pages, confidence}. Do not invent missing numbers.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                filename: input.filename,
                promptVersion: PROMPT_VERSIONS.ocrVision,
              }),
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    let text = content;
    let pages = 1;
    let confidence = 0.85;
    try {
      const parsed = parseJsonFromModelContent(content) as {
        text?: string;
        pages?: number;
        confidence?: number;
      };
      text = parsed.text ?? content;
      pages = Number(parsed.pages ?? 1) || 1;
      confidence = Number(parsed.confidence ?? 0.85);
    } catch {
      text = content;
    }

    return {
      text,
      pages,
      confidence,
      provider: this.name,
      providerVersion: PROMPT_VERSIONS.ocrVision,
      processingTimeMs: Date.now() - started,
      method: "ocr",
    };
  }
}
