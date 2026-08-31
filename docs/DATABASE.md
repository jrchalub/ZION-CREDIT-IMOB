# Database — ZION CREDIT

## Engine

PostgreSQL 16 puro via Docker Compose.

- Usuário da aplicação: `zioncredit`
- Database: `zion_credit`
- Host port: `5433` → container `5432`

```text
DATABASE_URL=postgresql://zioncredit:****@localhost:5433/zion_credit
```

## Tabelas FASE 1 + FASE 2

### Core
`tenants`, `users`, `clients`, `client_addresses`, `correspondents`, `developments`, `units`, `financing_processes`, `process_status_history`, `process_number_sequences`, `audit_logs`

### Documentos
`document_types`, `income_profile_document_requirements`, `documents`, `process_checklist_items`, `pendencies`

## Tabelas FASE 3 — Document Intelligence

| Tabela | Papel |
|--------|-------|
| `document_processing_runs` | Status do pipeline (não confundir com `documents.status`) |
| `document_ocr_results` | Texto OCR / native |
| `document_classifications` | Tipo sugerido + confiança + decisão |
| `document_extracted_fields` | Campos + evidência (page, evidence_text, bbox, provider) |
| `document_field_corrections` | Correções humanas |
| `document_consistency_checks` | Score/issues explicáveis |
| `bank_statements` / `bank_transactions` | Extração de extrato (sem análise de renda) |
| `ai_requests` / `ai_responses` | Auditoria de custo/provider |

Regra: **COMPLETED ≠ VALIDADO**.

## Tabelas FASE 4 — Financial Analysis

| Tabela | Papel |
|--------|-------|
| `financial_analyses` | Run versionável por processo |
| `income_analyses` | Declarada, mediana/média, confiança |
| `income_month_rolls` | Créditos brutos vs válidos por mês |
| `transaction_classifications` | Classificação / override humano |
| `credit_card_analyses` | Limite, fatura, comprometimento |
| `debts` | Obrigações mensais |
| `financial_commitments` | Consolidado (aluguel + dívidas + cartões) |
| `financing_simulations` | SAC/PRICE |
| `payment_capacity_snapshots` | Capacidade + % + indicativo |
| `financial_analysis_snapshots` | Snapshot **imutável** (ruleVersion + hash) |
| `decision_support_snapshots` | Dossiê FASE 5 imutável (`credit-support-v1`) |
| `decision_factors` | Fatores explicáveis com origem/evidência |
| `credit_analyst_reviews` | Parecer humano (justificativa + snapshot) |
| `process_sla` | SLA operacional (FASE 6) |
| `notifications` | Notificações outbound (FASE 6) |
| `users.correspondent_id` | Vínculo login → org correspondente (FASE 6.2) |
| `portal_access_tokens` | Token de portal cliente — só `token_hash` (FASE 6.3) |
| `pendencies` (lifecycle) | Self-service OPEN→…→RESOLVED (FASE 6.4) |
| `integration_calls` | Consultas Bureau/Bank read (FASE 6.6) |
| `banking_correspondents` | Canais bancários (CredOnline…) — FASE 7 |
| `commercial_banking_access` | Org comercial ↔ correspondente bancário |
| `financing_submissions` | Envio/acompanhamento institucional (FASE 7) |
| `process_attendance` | Vínculo CRM/WhatsApp + visita (6.7) |

FASE 7.1: `financing_processes.institutional_channel` (`NENHUM`/`CAIXA`/`OUTRO`) e `institutional_send_opt_in`. Flag do escritório em `tenants.settings.caixaSdkEnabled`.

## Convenções

- UUID como PK
- `tenant_id` em entidades de negócio
- Arquivos **não** ficam como blob no Postgres — apenas metadados + `storage_key`
- Históricos append-only

## Migrations

```bash
pnpm db:generate
pnpm db:migrate
```
