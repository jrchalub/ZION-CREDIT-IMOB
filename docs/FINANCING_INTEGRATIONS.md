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

- Upload de PDFs/binários ao banco
- Auto-transição para `APROVADO` / `REPROVADO`
- Escolha automática / ranking de correspondentes
- A caixa de documentos (intake) **não** envia arquivos ao correspondente/banco; o envio institucional permanece manual no painel FASE 7.

## FASE 7.1 — SDK Caixa opcional

O canal Caixa **não é padrão**. Três interruptores:

| Camada | Onde | Padrão |
|--------|------|--------|
| Escritório | Configurações → `caixaSdkEnabled` | desligado |
| Cliente | processo `institutional_channel` + `institutional_send_opt_in` | NENHUM / false |
| Ambiente | `CAIXA_SDK_ENABLED` + `CAIXA_API_URL` / token ou OAuth | desligado |

`institutional_channel`: `NENHUM` (não envia) · `CAIXA` · `OUTRO` (registro manual, sem SDK).

Adapter `caixa-sdk` fala HTTP com o gateway configurado (não há pacote npm oficial da Caixa Habitação). Sem CPF completo nem binários.

## Env

| Var | Uso |
|-----|-----|
| `FINANCING_PROVIDER` | `mock` \| `http` (ignorado se `CAIXA_SDK_ENABLED=true`) |
| `FINANCING_PROVIDER_URL` | HTTP POST submit/track |
| `FINANCING_PROVIDER_TOKEN` | Bearer opcional |
| `CAIXA_SDK_ENABLED` | `true` para usar adapter `caixa-sdk` |
| `CAIXA_API_URL` | Base do gateway Caixa |
| `CAIXA_API_TOKEN` | Bearer estático (opcional se OAuth) |
| `CAIXA_TOKEN_URL` / `CAIXA_CLIENT_ID` / `CAIXA_CLIENT_SECRET` | OAuth client credentials |

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
| POST | `/api/v1/processes/:id/financing` | `{ institution: "CAIXA"\|"OUTRO", bankingCorrespondentId }` |
| GET/PATCH | `/api/v1/settings` | `caixaSdkEnabled` (ADMIN/GESTOR) |
| POST | `/api/v1/processes/:id/financing/:submissionId/track` | track da submissão específica |

Sem `bankingCorrespondentId` → `400 BANKING_CORRESPONDENT_REQUIRED` (não cria linha).

## UI

Painel **Envio institucional**:

```
Destino do cliente: [ Não enviar | Caixa | Outro banco ]
[ ] Cliente autorizou
Correspondente bancário: [ CredOnline ▼ ]
[ Enviar à Caixa ]  [ Registrar outro banco ]
```

Histórico exibe correspondente, usuário, status e eventos por submissão.

Disclaimer: Zion Credit não concede crédito. Retorno institucional é indicativo até confirmação humana.
