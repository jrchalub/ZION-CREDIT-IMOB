# Deployment — ZION CREDIT

## Local

```bash
pnpm db:up          # postgres + redis + minio
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Produção (recomendação)

| Componente | Opção |
|------------|-------|
| App | Container Node / Vercel / VM |
| DB | PostgreSQL gerenciado (RDS, Cloud SQL, VM própria) |
| Cache/filas | Redis gerenciado |
| Storage | MinIO próprio, AWS S3 ou Cloudflare R2 (S3 API) |

Secrets apenas via variáveis de ambiente.

## Go-live (FASE 8)

Checklist antes de `NODE_ENV=production`:

```bash
pnpm go-live:check
pnpm db:migrate
pnpm db:catalog             # catálogo de documentos; sem usuários demo em produção
```

Subir app + workers (infra no `docker-compose.yml`):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Processos:

| Processo | Comando | Função |
|----------|---------|--------|
| App | `pnpm start` (porta 3000) | UI + API |
| Workers | `pnpm workers` | BullMQ document-processing + financial-analysis |

Health:

- Liveness: `GET /api/v1/health/live` (sem auth)
- Readiness: `GET /api/v1/health/ready` (sem auth; 503 se Postgres/Redis indisponíveis)

OCR/IA reais: `AI_PROVIDER=openai`, `OCR_PROVIDER=openai`, `OPENAI_API_KEY`.  
Webhook CRM: `CRM_WEBHOOK_SECRET` + `POST /api/v1/webhooks/crm`.

## Não fazer

- Não usar Supabase
- Não usar Firebase
- Não versionar `.env` com secrets
- Não expor bucket de documentos como público
