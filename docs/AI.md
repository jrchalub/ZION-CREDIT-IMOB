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
  ├─ MockOCRProvider (+ native PDF text when usable)
  └─ OpenAIOCRProvider (imagens vision; PDF nativo se houver texto)
```

`OCR_PROVIDER=mock|openai`. Se vazio, segue `AI_PROVIDER`. PDF escaneado sem texto extraível **não** é rasterizado — cai em revisão humana.

## Env

```text
AI_PROVIDER=mock|openai
OCR_PROVIDER=          # opcional; senão herda AI_PROVIDER
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_OCR_MODEL=gpt-4o-mini
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
