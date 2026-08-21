# Financing Integrations — ZION CREDIT (FASE 7)

**STATUS: BASELINE v1 + multi banking correspondents**

## Objetivo

Enviar e acompanhar proposta na instituição financeira via `FinancingProvider`, com **escolha explícita do correspondente bancário** em cada submissão.

## Correspondente comercial × correspondente bancário

| Entidade | Tabela | Papel |
|----------|--------|-------|
| Comercial (FASE 6.2) | `correspondents` | Org do corretor / portal operacional |
| Bancário (FASE 7) | `banking_correspondents` | Canal de envio (CredOnline, FinanCasa…) |

Um corretor comercial pode trabalhar com **vários** correspondentes bancários (`commercial_banking_access`).  
**Não** se assume um único correspondente bancário por tenant, corretor ou processo.

## Escopo v1

| Item | Entregue |
|------|----------|
| Interface `FinancingProvider` | submit + track |
| Mock Caixa + HTTP stub | `FINANCING_PROVIDER=mock\|http` |
| `banking_correspondents` | ATIVO/INATIVO + contato |
| `financing_submissions.banking_correspondent_id` | por submissão (histórico) |
| `financing_submission_events` | histórico de status da submissão |
| API/UI | select obrigatório + enviar / listar / track |
| Gate | `APTO` \| `AGUARDANDO_BANCO` \| `ENVIADO_AO_BANCO` (reenvio) |
| Pós-submit | transição → `ENVIADO_AO_BANCO` (se ainda não) |

## Fora de escopo v1

- SDK real Caixa / autenticação bancária
- Upload de PDFs/binários ao banco
- Auto-transição para `APROVADO` / `REPROVADO`
- Escolha automática / ranking de correspondentes

## Env

| Var | Uso |
|-----|-----|
| `FINANCING_PROVIDER` | `mock` \| `http` |
| `FINANCING_PROVIDER_URL` | HTTP POST submit/track |
| `FINANCING_PROVIDER_TOKEN` | Bearer opcional |

## Permissões e isolamento

- `financing:read` / `financing:write` — ADMIN, GESTOR, ANALISTA
- Analista: lista todos os bancários **ATIVO** do tenant
- Corretor (quando aplicável): só parceiros em `commercial_banking_access`
- Sem acesso cross-tenant
- Auditoria: seleção + `FINANCING_SUBMIT` / `FINANCING_TRACK`

## Modelo de submissão

```
Processo
  → Submissão (N)
       → banking_correspondent_id
       → institution (ex.: CAIXA)
       → status + payload
       → events[] (histórico)
```

Múltiplas submissões no mesmo processo são preservadas (ex.: CredOnline + FinanCasa).

## API

| Método | Rota | Body |
|--------|------|------|
| GET | `/api/v1/processes/:id/financing` | items + bankingCorrespondents |
| POST | `/api/v1/processes/:id/financing` | `{ institution, bankingCorrespondentId }` **obrigatório** |
| POST | `/api/v1/processes/:id/financing/:submissionId/track` | track da submissão específica |

Sem `bankingCorrespondentId` → `400 BANKING_CORRESPONDENT_REQUIRED` (não cria linha).

## UI

Painel **Envio institucional**:

```
Correspondente bancário: [ CredOnline ▼ ]
[ Enviar à Caixa (mock) ]
```

Histórico exibe correspondente, usuário, status e eventos por submissão.

Disclaimer: Zion Credit não concede crédito. Retorno institucional é indicativo até confirmação humana.
