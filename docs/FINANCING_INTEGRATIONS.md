# Financing Integrations — ZION CREDIT (FASE 7)

**STATUS: BASELINE v1**

## Objetivo

Enviar e acompanhar proposta na instituição financeira via `FinancingProvider`, sem acoplar o domínio a SDK da Caixa.

## Escopo v1

| Item | Entregue |
|------|----------|
| Interface `FinancingProvider` | submit + track |
| Mock Caixa + HTTP stub | `FINANCING_PROVIDER=mock\|http` |
| Persistência `financing_submissions` | metadados + ref + status externo |
| API/UI analista | enviar / listar / track |
| Gate | status `APTO` ou `AGUARDANDO_BANCO` |
| Pós-submit | transição automática → `ENVIADO_AO_BANCO` |

## Fora de escopo v1

- SDK real Caixa / autenticação bancária
- Upload de PDFs/binários ao banco
- Auto-transição para `APROVADO` / `REPROVADO` (só humana)

## Env

| Var | Uso |
|-----|-----|
| `FINANCING_PROVIDER` | `mock` \| `http` |
| `FINANCING_PROVIDER_URL` | HTTP POST submit/track |
| `FINANCING_PROVIDER_TOKEN` | Bearer opcional |

## Permissões

`financing:read` / `financing:write` — ADMIN, GESTOR, ANALISTA.

## Arquitetura

```
Analista
  → POST /processes/:id/financing
  → FinancingSubmissionService
  → FinancingProvider (mock | http)
  → financing_submissions
  → status ENVIADO_AO_BANCO
```

Disclaimer: Zion Credit não concede crédito. Retorno institucional é indicativo até confirmação humana.
