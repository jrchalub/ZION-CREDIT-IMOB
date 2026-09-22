import type {
  ClassificationInput,
  ClassificationResult,
  DocumentAIProvider,
  ExtractionInput,
  ExtractionResult,
} from "./DocumentAIProvider";
import { PROMPT_VERSIONS } from "../prompts/versions";
import { MockDocumentAIProvider } from "./MockDocumentAIProvider";
import {
  getOpenAICompatApiKey,
  getOpenAICompatChatModel,
  openAICompatChatCompletion,
  parseJsonFromModelContent,
} from "./openai-compat";

/**
 * OpenAI-compatible provider (OpenAI API or OpenRouter via OPENAI_BASE_URL).
 * Without OPENAI_API_KEY, falls back to Mock to keep the app operational.
 */
export class OpenAIDocumentAIProvider implements DocumentAIProvider {
  readonly name = "openai";
  private readonly fallback = new MockDocumentAIProvider();

  private get apiKey() {
    return getOpenAICompatApiKey();
  }

  private get model() {
    return getOpenAICompatChatModel();
  }

  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    if (!this.apiKey) {
      const mock = await this.fallback.classify(input);
      return { ...mock, provider: `${this.name}+mock-fallback` };
    }

    const { content } = await openAICompatChatCompletion({
      model: this.model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Classify Brazilian credit documents. Return ONLY JSON {documentType, confidence}. documentType must be one of the provided codes.",
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
    });

    const parsed = parseJsonFromModelContent(content) as {
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

    const { content } = await openAICompatChatCompletion({
      model: this.model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract structured fields from Brazilian documents. Return ONLY JSON {fields:[{field,value,normalizedValue,confidence,page,evidenceText}]}. Include evidenceText for every field. Do not estimate income.",
        },
        {
          role: "user",
          content: JSON.stringify({
            documentType: input.documentType,
            textSample: input.text.slice(0, 8000),
          }),
        },
      ],
    });

    const parsed = parseJsonFromModelContent(content) as ExtractionResult;

    return {
      fields: parsed.fields ?? [],
      extras: parsed.extras,
      provider: this.name,
      model: this.model,
      promptVersion: PROMPT_VERSIONS.bankStatementExtraction,
    };
  }
}
