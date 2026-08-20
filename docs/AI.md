# AI — ZION CREDIT

## Design

```text
DocumentAIProvider
  ├─ MockDocumentAIProvider   (dev/test — default)
  └─ OpenAIDocumentAIProvider (opcional)
```

OCR:

```text
OCRProvider
  └─ MockOCRProvider (+ native PDF text when usable)
```

## Env

```text
AI_PROVIDER=mock|openai
OPENAI_API_KEY=
OPENAI_MODEL=
AI_CLASSIFICATION_AUTO_THRESHOLD=0.90
AI_CLASSIFICATION_REVIEW_THRESHOLD=0.70
MOCK_AI_SCENARIO=
```

## Auditoria de custo

Tabelas `ai_requests` / `ai_responses` registram provider, model, operation, prompt_version, tokens, custo estimado, duração — sem dump desnecessário de PII.

## Regras

- IA não valida documento (`VALIDADO` só humano)
- IA não aprova crédito
- Prompts versionados em `src/modules/document-intelligence/prompts/versions.ts`
