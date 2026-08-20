import type { DocumentAIProvider } from "./DocumentAIProvider";
import { MockDocumentAIProvider } from "./MockDocumentAIProvider";
import { OpenAIDocumentAIProvider } from "./OpenAIDocumentAIProvider";

export function getDocumentAIProvider(): DocumentAIProvider {
  const provider = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  if (provider === "openai") {
    return new OpenAIDocumentAIProvider();
  }
  return new MockDocumentAIProvider();
}
