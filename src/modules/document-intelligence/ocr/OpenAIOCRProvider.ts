import type { OCRInput, OCRProvider, OCRResult } from "./OCRProvider";
import { MockOCRProvider, extractNativePdfText } from "./MockOCRProvider";
import { PROMPT_VERSIONS } from "../prompts/versions";
import { visionMimeFromDocument } from "./ocr-provider-select";

/**
 * Vision OCR via OpenAI. Native PDF text still preferred (no cost).
 * Scanned PDFs without extractable text are not rasterized here — review humana.
 */
export class OpenAIOCRProvider implements OCRProvider {
  readonly name = "openai-ocr";
  private readonly fallback = new MockOCRProvider();

  private get apiKey() {
    return process.env.OPENAI_API_KEY?.trim() || "";
  }

  private get model() {
    return process.env.OPENAI_OCR_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
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
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
                text: JSON.stringify({ filename: input.filename, promptVersion: PROMPT_VERSIONS.ocrVision }),
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OPENAI_OCR_FAILED:${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    let text = content;
    let pages = 1;
    let confidence = 0.85;
    try {
      const parsed = JSON.parse(content) as {
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
