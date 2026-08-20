import type {
  ClassificationInput,
  ClassificationResult,
  DocumentAIProvider,
  ExtractionInput,
  ExtractionResult,
} from "./DocumentAIProvider";
import { PROMPT_VERSIONS } from "../prompts/versions";
import { MockDocumentAIProvider } from "./MockDocumentAIProvider";

/**
 * OpenAI-backed provider.
 * Without OPENAI_API_KEY, falls back to Mock to keep the app operational.
 * Never call this from controllers — use getDocumentAIProvider().
 */
export class OpenAIDocumentAIProvider implements DocumentAIProvider {
  readonly name = "openai";
  private readonly fallback = new MockDocumentAIProvider();

  private get apiKey() {
    return process.env.OPENAI_API_KEY?.trim() || "";
  }

  private get model() {
    return process.env.OPENAI_MODEL || "gpt-4o-mini";
  }

  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    if (!this.apiKey) {
      const mock = await this.fallback.classify(input);
      return { ...mock, provider: `${this.name}+mock-fallback` };
    }

    // Real HTTP call reserved for when key is configured.
    // Keeps dependency optional: no openai package required for default mock mode.
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Classify Brazilian credit documents. Return JSON {documentType, confidence}. documentType must be one of the provided codes.",
          },
          {
            role: "user",
            content: JSON.stringify({
              knownTypeCodes: input.knownTypeCodes,
              filename: input.filename,
              textSample: input.text.slice(0, 4000),
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OPENAI_CLASSIFY_FAILED:${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("OPENAI_EMPTY_RESPONSE");
    const parsed = JSON.parse(content) as {
      documentType?: string;
      confidence?: number;
    };

    return {
      documentType: String(parsed.documentType ?? "OUTRO"),
      confidence: Number(parsed.confidence ?? 0),
      provider: this.name,
      model: this.model,
      promptVersion: PROMPT_VERSIONS.classification,
    };
  }

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    if (!this.apiKey) {
      const mock = await this.fallback.extract(input);
      return { ...mock, provider: `${this.name}+mock-fallback` };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Extract structured fields from Brazilian documents. Return JSON {fields:[{field,value,normalizedValue,confidence,page,evidenceText}]}. Include evidenceText for every field. Do not estimate income.",
          },
          {
            role: "user",
            content: JSON.stringify({
              documentType: input.documentType,
              textSample: input.text.slice(0, 8000),
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OPENAI_EXTRACT_FAILED:${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("OPENAI_EMPTY_RESPONSE");
    const parsed = JSON.parse(content) as ExtractionResult;

    return {
      fields: parsed.fields ?? [],
      extras: parsed.extras,
      provider: this.name,
      model: this.model,
      promptVersion: PROMPT_VERSIONS.bankStatementExtraction,
    };
  }
}
