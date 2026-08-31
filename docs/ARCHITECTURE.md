# Architecture — ZION CREDIT

## Princípios

- Self-managed: PostgreSQL + Redis + MinIO sob controle da infraestrutura
- Sem BaaS (sem Supabase, sem Firebase)
- Orientado a processos, evidências, auditoria e human-in-the-loop
- Multi-tenant com isolamento por `tenant_id` (sempre do contexto autenticado)

## Stack oficial

```text
Next.js 16 + TypeScript
        ↓
API /api/v1/*
        ↓
Domain services
        ↓
┌─────────────┬──────────┬────────────┐
│ PostgreSQL  │  Redis   │   MinIO    │
│ (Drizzle)   │ BullMQ   │ S3 API     │
└─────────────┴──────────┴────────────┘
```

## Storage de documentos

```text
Upload → validação MIME/tamanho/hash
      → MinIO (objeto privado)
      → metadados no PostgreSQL
      → fila document-processing (BullMQ)
      → checklist atualizado
```

Visualização apenas via **URL assinada temporária** gerada pela API após autorização.

## Filas (BullMQ)

- `document-processing` — OCR → classify → extract → consistency (FASE 3)
- `financial-analysis` — classificação de lançamentos → renda → compromissos → simulação (FASE 4)
- `ocr-processing` / `ai-processing` — reservadas (hoje unificadas no worker de document-processing)
- `notifications`

## Document Intelligence (FASE 3 — PRODUCTION CLOSED)

```text
documents.status          → ciclo documental (VALIDADO só humano)
document_processing_runs  → pipeline OCR/IA (COMPLETED ≠ VALIDADO)

DocumentAIProvider (mock | openai)
OCRProvider (mock | openai vision + native PDF text)
```

Worker: `pnpm workers` (SIGTERM fecha filas)

## Go-live (FASE 8)

Health live/ready, rate-limit de login, seed sem demo em produção, webhook CRM → `process_attendance`, `Dockerfile` + `docker-compose.prod.yml`. Ver [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Financial Analysis (FASE 4 — PRODUCTION CLOSED)

```text
bank_statements / bank_transactions
        ↓
TransactionClassifier (rules-v1)
        ↓
IncomeAnalysis (créditos válidos → mediana)
        ↓
Commitments + Simulation SAC/PRICE
        ↓
financial_analysis_snapshots (imutável + hash)
```

## Credit Decision Support (FASE 5 — PRODUCTION CLOSED)

```text
checklist + consistency + pendencies + immutable financial snapshot
        ↓
DecisionSupportSnapshot (credit-support-v1) + explainable factors
        ↓
Process Dossier + Analyst Review (human)
```

Baseline: [`BASELINE_FASE_5.md`](./BASELINE_FASE_5.md)

## Operations (FASE 6 — PRODUCTION CLOSED)

Workflow operacional, portais, notificações, SLA, adapters — ver [`OPERATIONS.md`](./OPERATIONS.md).

## Institutional Financing (FASE 7 — multi banking correspondents)

```text
banking_correspondent (obrigatório)
        ↓
FinancingSubmissionService
        ↓
FinancingProvider (mock-caixa | http)
        ↓
financing_submissions + events → status ENVIADO_AO_BANCO
```

`banking_correspondents` ≠ `correspondents` (comercial FASE 6.2).  
Ver [`FINANCING_INTEGRATIONS.md`](./FINANCING_INTEGRATIONS.md).

## Estrutura

```text
src/
  app/           # UI + API
  components/
  db/            # schema Drizzle + migrations + seed
  domain/        # regras de negócio
  modules/
    document-intelligence/     # FASE 3 (frozen)
    financial-analysis/        # FASE 4 (frozen)
    credit-decision-support/   # FASE 5 (frozen)
    operations/                # FASE 6 (frozen)
    financing-integrations/    # FASE 7
    document-intake/           # caixa de documentos + CRM
    go-live/                   # FASE 8
  workers/       # BullMQ workers
  infra/         # redis, queues, storage providers
  lib/           # auth, api, logger, cpf
docs/
```
