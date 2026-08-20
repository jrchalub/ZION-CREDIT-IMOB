# Phases — ZION CREDIT

## FASE 1 — Foundation

**STATUS: PRODUCTION CLOSED**

## FASE 2 — Document Management

**STATUS: PRODUCTION CLOSED**

## FASE 3 — Document Intelligence

**STATUS: PRODUCTION CLOSED**

Baseline: Mock OCR/AI, evidências, worker, human-in-the-loop.  
Freeze: `src/modules/document-intelligence/**` — só bugfix.

## FASE 4 — Financial Analysis

**STATUS: PRODUCTION CLOSED**

Baseline: renda defensável (mediana), snapshot imutável `rules-v1`.  
Freeze: `src/modules/financial-analysis/**` — só bugfix.

## FASE 5 — Credit Decision Support

**STATUS: PRODUCTION CLOSED**

Baseline completo: [`BASELINE_FASE_5.md`](./BASELINE_FASE_5.md)

### Freeze

Alterações em `src/modules/credit-decision-support/**` apenas para **bugfix crítico**.

## FASE 6 — Operations & Integrations

**STATUS: PRODUCTION CLOSED**

Baseline: [`OPERATIONS.md`](./OPERATIONS.md)

Incrementos: 6.1 núcleo · 6.2 correspondente · 6.3 portal cliente · 6.4 pendências · 6.5 WhatsApp · **6.6 IntegrationProvider**

### Freeze

`src/modules/operations/**` — só bugfix crítico.  
Não reescrever crédito/IA nesta fase.

## FASE 7 — Institutional Financing Integrations

**STATUS: PLANNED**

`FinancingProvider` multi-instituição (Caixa / Banco X / Banco Y) sem acoplar o domínio.

## Roadmap

| Fase | Nome | Status |
|------|------|--------|
| 1 | Foundation | **PRODUCTION CLOSED** |
| 2 | Document Management | **PRODUCTION CLOSED** |
| 3 | Document Intelligence | **PRODUCTION CLOSED** |
| 4 | Financial Analysis | **PRODUCTION CLOSED** |
| 5 | Credit Decision Support | **PRODUCTION CLOSED** |
| 6 | Operations & Integrations | **PRODUCTION CLOSED** |
| 7 | Institutional Financing Integrations | PLANNED |
