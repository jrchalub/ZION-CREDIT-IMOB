# API — ZION CREDIT

Base: `/api/v1`

Respostas:

```json
{ "data": { } }
```

Erros:

```json
{ "error": { "message": "...", "code": "...", "correlationId": "..." } }
```

## Endpoints FASE 1

| Método | Rota | Permissão |
|--------|------|-----------|
| POST | `/auth` | público (login) |
| GET | `/auth` | sessão atual |
| DELETE | `/auth` | logout |
| GET/POST | `/clients` | `clients:read/write` |
| GET/PATCH | `/clients/:id` | `clients:read/write` |
| GET/POST | `/processes` | `processes:read/write` |
| GET/PATCH/DELETE | `/processes/:id` | `processes:read` / `processes:write` | Detalhe; editar dados; excluir (NOVO/CANCELADO ou ADMIN/GESTOR) |
| POST | `/processes/:id/transition` | `processes:transition` |
| GET/POST | `/processes/:id/documents` | `documents:read/write` |
| GET/PATCH | `/processes/:id/checklist` | `documents:read/write` |
| GET/POST | `/documents/:id` | `documents:read` / `documents:review` |
| GET/POST | `/pendencies` | `pendencies:read/write` |
| PATCH | `/pendencies/:id` | `pendencies:write` |
| GET | `/document-types` | `documents:read` |
| GET | `/health` | autenticado (postgres/redis/minio) |

## Endpoints FASE 3 — Document Intelligence

| Método | Rota | Permissão | Notas |
|--------|------|-----------|-------|
| GET | `/documents/:id/intelligence` | `documents:read` | OCR, classificação, campos+evidência, consistência, run status |
| PATCH | `/documents/:id/intelligence` | `documents:review` | Correção humana de campo extraído |
| POST | `/documents/:id/reprocess` | `documents:review` | `{ mode: "enqueue" \| "sync" }` |

UI: `/documents/:id/review`

**COMPLETED ≠ VALIDADO.** Pipeline em `document_processing_runs`; validação humana em `documents.status`.

## Endpoints FASE 4 — Financial Analysis

| Método | Rota | Permissão | Notas |
|--------|------|-----------|-------|
| GET/POST | `/processes/:id/financial-analysis` | `financial:read` / `financial:write` | Pré-análise; POST `{ mode: "sync" \| "enqueue" }` |
| GET/POST | `/processes/:id/debts` | `financial:read` / `financial:write` | Dívidas manuais do processo |
| PATCH | `/bank-transactions/:id/classification` | `financial:write` | Override humano de categoria |
| GET | `/processes/:id/dossier` | `decision:read` | FASE 5 — dossiê completo explicável |
| POST | `/processes/:id/dossier` | `decision:write` | Gera DecisionSupportSnapshot + factors |
| GET/POST | `/processes/:id/analyst-review` | `decision:read` / `decision:write` | Parecer humano (start / decide) |
| GET | `/processes/:id/operational` | `processes:read` | FASE 6.2 — visão operacional (correspondent-safe) |
| GET/POST | `/processes/:id/portal-access` | `processes:write` | FASE 6.3 — listar / emitir link do cliente |
| POST | `/processes/:id/portal-access/:tokenId/revoke` | `processes:write` | Revoga token |
| GET | `/portal/:token` | token | Visão cliente (sem dados internos) |
| POST | `/portal/:token/documents` | token | Upload via portal |
| PATCH | `/portal/:token/pendencies/:id` | token | Cliente → SUBMITTED |
| GET | `/operations/dashboard` | `operations:read` | FASE 6 — filas, aging, SLA (tenant-wide) |
| GET/POST | `/pendencies` | `pendencies:read/write` | FASE 6.4 — create OPEN; notify emite deep link (6.5) |
| PATCH | `/pendencies/:id` | `pendencies:write` ou `pendencies:respond` | Máquina OPEN→SUBMITTED→… |
| GET/POST | `/processes/:id/integrations` | `integrations:read/write` | FASE 6.6 — Bureau / Bank read |
| GET/POST | `/processes/:id/financing` | `financing:read/write` | FASE 7 — list/submit (`bankingCorrespondentId` obrigatório no POST) |
| POST | `/processes/:id/financing/:submissionId/track` | `financing:write` | FASE 7 — track da submissão específica |

FASE 6.5: criar pendência com `notifyClient` gera token de portal + mensagem WhatsApp/email (link apenas; sem documento no canal).  
FASE 6.6: integrações de **leitura** apenas.  
FASE 7: envio institucional via `FinancingProvider` (metadados; sem binários na v1). Cada submissão registra correspondente bancário. APROVADO/REPROVADO só com transição humana.

Disclaimer obrigatório: suporte à decisão — não é aprovação bancária. Sem score mágico.

Paginação: `?page=1&pageSize=20`

Upload: `multipart/form-data` com `file` + `checklistItemId`.

Visualização: `GET /documents/:id?view=1` → `{ url, expiresInSeconds }` (signed URL).
