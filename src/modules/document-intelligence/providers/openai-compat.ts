/**
 * OpenAI-compatible chat client (OpenAI, OpenRouter, etc.).
 * Uses OPENAI_BASE_URL when set (e.g. https://openrouter.ai/api/v1).
 */

export function getOpenAICompatApiKey(): string {
  return process.env.OPENAI_API_KEY?.trim() || "";
}

export function getOpenAICompatBaseUrl(): string {
  const raw = process.env.OPENAI_BASE_URL?.trim();
  if (!raw) return "https://api.openai.com/v1";
  return raw.replace(/\/+$/, "");
}

export function getOpenAICompatChatModel(): string {
  return (
    process.env.OPENAI_CHAT_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

export function getOpenAICompatOcrModel(): string {
  return (
    process.env.OPENAI_OCR_MODEL?.trim() ||
    process.env.OPENAI_CHAT_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

function isOpenRouter(): boolean {
  return getOpenAICompatBaseUrl().includes("openrouter.ai");
}

/** Many free OpenRouter models reject response_format / structured outputs. */
function useJsonResponseFormat(): boolean {
  const forced = process.env.OPENAI_JSON_MODE?.trim().toLowerCase();
  if (forced === "true" || forced === "1") return true;
  if (forced === "false" || forced === "0") return false;
  return !isOpenRouter();
}

function getTimeoutMs(): number {
  const sec = Number(process.env.OPENAI_TIMEOUT ?? "45");
  if (!Number.isFinite(sec) || sec <= 0) return 45_000;
  return Math.round(sec * 1000);
}

function buildHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (isOpenRouter()) {
    const referer = process.env.APP_URL?.trim() || "http://localhost:3000";
    headers["HTTP-Referer"] = referer;
    headers["X-Title"] = process.env.OPENROUTER_APP_TITLE?.trim() || "ZION CREDIT";
  }

  return headers;
}

export type ChatCompletionBody = {
  model: string;
  messages: unknown[];
  response_format?: { type: "json_object" };
  temperature?: number;
};

export function parseJsonFromModelContent(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("OPENAI_JSON_PARSE_FAILED");
  }
}

export async function openAICompatChatCompletion(
  body: ChatCompletionBody,
): Promise<{ content: string; raw: unknown }> {
  const apiKey = getOpenAICompatApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY_MISSING");

  const payload: ChatCompletionBody = { ...body };
  if (payload.response_format && !useJsonResponseFormat()) {
    delete payload.response_format;
  }

  const url = `${getOpenAICompatBaseUrl()}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `OPENAI_COMPAT_FAILED:${response.status}:${detail.slice(0, 300)}`,
      );
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("OPENAI_EMPTY_RESPONSE");
    return { content, raw: json };
  } finally {
    clearTimeout(timer);
  }
}
