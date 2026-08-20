# Baseline — FASE 5 Credit Decision Support

**STATUS: PRODUCTION CLOSED**  
**Data:** 2026-08-20  
**Validação:** migrations do zero (volumes recriados) + `pnpm test` + `tsc --noEmit`

---

## Marco do produto

```text
FASE 1  Foundation                 PRODUCTION CLOSED
FASE 2  Document Management        PRODUCTION CLOSED
FASE 3  Document Intelligence      PRODUCTION CLOSED
FASE 4  Financial Analysis         PRODUCTION CLOSED
FASE 5  Credit Decision Support    PRODUCTION CLOSED  ← este baseline
FASE 6  Operations & Integrations  IN PROGRESS (aberta após este freeze)
```

Ciclo assistido completo (sem IA como autoridade de crédito):

```text
Cliente → Processo → Documentação → OCR/IA → Extração → Validação humana
  → Análise financeira → Snapshot financeiro → Dossiê → Fatores explicáveis
  → Analista → Parecer → Decisão humana → Auditoria
```

---

## Versões congeladas (Decision Support)

| Constante | Valor |
|-----------|--------|
| `CREDIT_SUPPORT_VERSION` | `credit-support-v1` |
| `CREDIT_SUPPORT_RULES_VERSION` | `credit-support-v1` |
| Schema payload | `cds-v1` |
| Financial rules (FASE 4) | `rules-v1` / `income-v1` |

**Regra:** alterações futuras de fatores/matriz = **nova versão** (`credit-support-v2`).  
Snapshots em `decision_support_snapshots` são **append-only** — não reescrever histórico.

### Hash da migration FASE 5

| Arquivo | SHA-256 |
|---------|---------|
| `src/db/migrations/0005_numerous_serpent_society.sql` | `E6E0C54036F80B96C45D36BB26DB9B2EAAE0AD5DC8C4FCE08C47223B41E25FFE` |

Migrations acumuladas neste baseline: `0000` … `0005`.

---

## Arquitetura (camadas 1–5)

```text
Next.js 16 + TypeScript
        │
API /api/v1/*
        │
┌───────────────────┬────────────────────┬──────────────────────────┐
│ domain/           │ modules/           │ workers/                 │
│ auth, clients,    │ document-intel.    │ document-processing      │
│ processes, docs   │ financial-analysis │ financial-analysis       │
│                   │ credit-decision-   │                          │
│                   │   support          │                          │
└───────────────────┴────────────────────┴──────────────────────────┘
        │
┌─────────────┬──────────┬────────────┐
│ PostgreSQL  │  Redis   │   MinIO    │
│ (Drizzle)   │ BullMQ   │ S3 API     │
└─────────────┴──────────┴────────────┘
```

Trilha de explicabilidade:

```text
DECISÃO (credit_analyst_reviews)
  → FATOR (decision_factors)
  → SNAPSHOT CDS (decision_support_snapshots)
  → SNAPSHOT FINANCEIRO (financial_analysis_snapshots)
  → DADO / DOCUMENTO / PÁGINA / EVIDÊNCIA
```

---

## Schema relevante (FASE 5)

| Tabela | Papel |
|--------|-------|
| `decision_support_snapshots` | Snapshot imutável do dossiê (`rules_version`, `content_hash`, `payload`, `matrix`) |
| `decision_factors` | Fatores POSITIVO / ATENCAO / PENDENCIA + `origin_*` + `evidence` |
| `credit_analyst_reviews` | Parecer humano PENDING→IN_REVIEW→APPROVED\|REJECTED\|RETURNED |

Dependências FASE 4 (somente leitura):

- `financial_analysis_snapshots`
- `financial_analyses`, `income_*`, `debts`, `credit_card_analyses`, etc.

Indicativos CDS (não são score numérico):

- `FAVORAVEL` | `REQUER_ANALISE` | `DESFAVORAVEL`

---

## APIs (baseline FASES 1–5)

### Auth / core
| Método | Rota |
|--------|------|
| POST/GET/DELETE | `/api/v1/auth` |
| GET/POST | `/api/v1/clients` |
| GET/PATCH | `/api/v1/clients/:id` |
| GET/POST | `/api/v1/processes` |
| GET | `/api/v1/processes/:id` |
| POST | `/api/v1/processes/:id/transition` |
| GET | `/api/v1/dashboard` |
| GET | `/api/v1/audit` |
| GET | `/api/v1/health` |

### Documentos (FASE 2–3)
| Método | Rota |
|--------|------|
| GET/POST | `/api/v1/processes/:id/documents` |
| GET/POST | `/api/v1/documents/:id` |
| GET/PATCH | `/api/v1/documents/:id/intelligence` |
| POST | `/api/v1/documents/:id/reprocess` |
| GET/PATCH | `/api/v1/processes/:id/checklist` |
| GET/POST | `/api/v1/pendencies` |
| PATCH | `/api/v1/pendencies/:id` |
| GET | `/api/v1/document-types` |

### Financeiro (FASE 4)
| Método | Rota |
|--------|------|
| GET/POST | `/api/v1/processes/:id/financial-analysis` |
| GET/POST | `/api/v1/processes/:id/debts` |
| PATCH | `/api/v1/bank-transactions/:id/classification` |

### Decision Support (FASE 5)
| Método | Rota |
|--------|------|
| GET/POST | `/api/v1/processes/:id/dossier` |
| GET/POST | `/api/v1/processes/:id/analyst-review` |

UI: `/processes/:id/dossier`

---

## Invariantes (não negociáveis)

1. IA **não** aprova crédito  
2. IA **não** reprova crédito  
3. Snapshot financeiro é **imutável**  
4. Decision Support snapshot é **imutável** (append-only)  
5. Dossiê é **reproduzível** a partir dos snapshots  
6. Todo fator possui **origem** (`originType` / `originId` / `evidence`)  
7. Dados extraídos possuem **evidência** (página/trecho) quando aplicável  
8. Decisão humana possui **responsável** (`analystId`)  
9. Decisão humana possui **justificativa** (mín. 10 chars em APPROVED/REJECTED/RETURNED)  
10. Histórico **não** é sobrescrito  
11. Multi-tenant isolado por `tenant_id` da sessão  
12. Sem score-caixa-preta — matriz categórica apenas  
13. `COMPLETED` (pipeline) ≠ `VALIDADO` (documento) ≠ `APPROVED` (parecer interno)

---

## Freeze

Alterações em:

- `src/modules/credit-decision-support/**`
- `src/modules/financial-analysis/**`
- `src/modules/document-intelligence/**`

apenas para **bugfix crítico**.

Evolução operacional (workflow diário, portais, WhatsApp, SLA, adapters) → **FASE 6**.

---

## Validação deste baseline

| Check | Resultado |
|-------|-----------|
| `docker compose down -v` + `up` | OK |
| `pnpm db:migrate` (0000→0005) | OK |
| `pnpm db:seed` | OK |
| `pnpm test` | **60 passed** / 14 files |
| `pnpm exec tsc --noEmit` | OK |

Demo: `admin@zioncredit.demo` / `Zion@Demo123` · processo `PF-YYYY-000001`
