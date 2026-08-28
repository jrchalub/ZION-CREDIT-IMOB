# Document Intelligence — ZION CREDIT (FASE 3)

> **STATUS: PRODUCTION CLOSED** — ver [`PHASES.md`](./PHASES.md).  
> Não evoluir renda/simulação aqui. FASE 4 consome `bank_statements` / `bank_transactions` em módulo separado.

## Separação de estados

| Camada | Campo | Significado |
|--------|-------|-------------|
| Documento | `documents.status` | Ciclo de vida documental |
| Pipeline | `document_processing_runs.status` | OCR/classificação/extração |

**COMPLETED ≠ VALIDADO.** Validação definitiva é sempre humana.

Estados do documento: `PENDENTE | RECEBIDO | PROCESSANDO | VALIDADO | REJEITADO | EXPIRADO`

Estados do pipeline: `PENDING → QUEUED → PROCESSING → OCR_PROCESSING → CLASSIFYING → EXTRACTING → VALIDATING → COMPLETED | REQUIRES_REVIEW | FAILED`

## Pipeline

```text
Upload → MinIO → enqueue document-processing
  → worker
  → texto nativo ou OCR
  → classify (DocumentAIProvider)
  → extract + evidências por campo
  → consistency check
  → pendências idempotentes
  → human review
```

Caixa de documentos (`src/modules/document-intake`) consome este pipeline: upload em lote sem `checklistItemId`, depois organiza no checklist se a classificação for `AUTO_SUGGESTED`. Tipo desconhecido ou baixa confiança → revisão humana. **Não** substitui o motor OCR/IA.

## Providers

- `AI_PROVIDER=mock` (default) — cenários: SUCCESS, LOW_CONFIDENCE, NAME_MISMATCH, CPF_MISMATCH, INVALID_JSON, PROVIDER_ERROR, OCR_ERROR
- `AI_PROVIDER=openai` — usa OpenAI se `OPENAI_API_KEY` estiver definida; senão fallback mock

Controllers nunca chamam vendors diretamente.

## Evidência

Cada campo em `document_extracted_fields` inclui `page`, `evidence_text`, `bounding_box`, `confidence`, `provider`, `prompt_version`.

## Workers

```bash
pnpm workers
```

## Revisão humana

`/documents/:id/review` — arquivo, OCR, classificação, campos, evidências, consistência, corrigir/validar/rejeitar.

## Bank statements

Extração de extrato + transações em FASE 3 **sem** cálculo de renda (FASE 4).
