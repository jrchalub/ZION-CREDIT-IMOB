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
| GET | `/processes/:id` | `processes:read` |
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
| GET/POST | `/processes/:id/financial-analysis` | `processes:read` / `processes:write` | Pré-análise; POST `{ mode: "sync" \| "enqueue" }` |
| GET/POST | `/processes/:id/debts` | `processes:read` / `processes:write` | Dívidas manuais do processo |
| PATCH | `/bank-transactions/:id/classification` | `processes:write` | Override humano de categoria |
| GET | `/processes/:id/dossier` | `processes:read` | FASE 5 — dossiê completo explicável |
| POST | `/processes/:id/dossier` | `processes:write` | Gera DecisionSupportSnapshot + factors |
| GET/POST | `/processes/:id/analyst-review` | `processes:read/write` | Parecer humano (start / decide) |

Disclaimer obrigatório: suporte à decisão — não é aprovação bancária. Sem score mágico.

Paginação: `?page=1&pageSize=20`

Upload: `multipart/form-data` com `file` + `checklistItemId`.

Visualização: `GET /documents/:id?view=1` → `{ url, expiresInSeconds }` (signed URL).
