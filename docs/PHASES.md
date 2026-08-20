# Phases — ZION CREDIT

## FASE 3 — Document Intelligence

**STATUS: PRODUCTION CLOSED**

Baseline (2026-08-20):

- 23 testes passando (baseline histórico)
- Migration `0002_*` aplicada
- Worker / Mock OCR / Mock AI / Human-in-the-loop / Auditoria funcionais

### Freeze

Alterações em `src/modules/document-intelligence/**` apenas para **bugfix crítico**.

## FASE 4 — Financial Analysis

**STATUS: PRODUCTION CLOSED**

Baseline de fechamento:

- Snapshot financeiro **imutável** (`financial_analysis_snapshots`) com `RULE_VERSION=rules-v1`
- Hash SHA-256 do payload (auditoria)
- Hardening: 15 cenários de qualidade (determinístico)
- Extratos duplicados ignorados via `duplicateOfDocumentId`
- Migration `0003_*` + coluna `rule_version` + snapshots
- Motor: classificação, renda (mediana), cartão, dívidas, SAC/PRICE, capacidade
- Sem aprovação de crédito bancário

### Freeze

Alterações em `src/modules/financial-analysis/**` apenas para **bugfix crítico**.

Novas regras = **nova versão** (`rules-v2`, `income-v2`). Snapshots antigos **não** são reescritos.

Disclaimer obrigatório:

> Resultado de pré-análise interna. Não representa aprovação ou reprovação de crédito por instituição financeira.

## FASE 5 — Credit Decision Support

**STATUS: IN PROGRESS**

Dossiê explicável para o analista (sem score-caixa-preta).

Entregue:

- `decision_support_snapshots` (imutável, `credit-support-v1`)
- `decision_factors` com origem/evidência
- Matriz categórica (OK / Atenção / Crítico)
- `credit_analyst_reviews` (parecer com justificativa)
- Dossiê completo `/processes/:id/dossier`
- APIs dossier + analyst-review

Docs: [`CREDIT_DECISION_SUPPORT.md`](./CREDIT_DECISION_SUPPORT.md)

## Roadmap

| Fase | Nome | Status |
|------|------|--------|
| 1 | Foundation | CLOSED |
| 2 | Documentos | CLOSED |
| 3 | Document Intelligence | **PRODUCTION CLOSED** |
| 4 | Financial Analysis | **PRODUCTION CLOSED** |
| 5 | Credit Decision Support | **IN PROGRESS** |
| 6 | Parecer | PLANNED |
| 7 | Portal do cliente | PLANNED |
| 8 | WhatsApp | PLANNED |
| 9 | Hardening / produção | PLANNED |
