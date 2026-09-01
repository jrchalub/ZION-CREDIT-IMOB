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

## EasyPanel (stack completo)

### Erro comum: `failed to read dockerfile: open docker-compose.yml`

Isso ocorre quando o serviço está como **App** e, em **Fonte**, o campo **Dockerfile** aponta para `docker-compose.yml`. O EasyPanel tenta `docker build -f docker-compose.yml` — compose **não** é Dockerfile.

**Correção:** use um dos caminhos abaixo (não misture).

### Caminho 1 — Docker Compose (recomendado: Postgres + Redis + MinIO + app + workers)

1. No projeto `zionimob`, **+ Serviço** → tipo **Compose** (não “App”).
2. Fonte: mesmo repositório GitHub.
3. Campo do compose: `docker-compose.yml` (campo **Compose file**, não “Dockerfile”).
4. Aba **Ambiente** — defina pelo menos:
   - `AUTH_SECRET` (≥32 caracteres, aleatório)
   - `APP_URL` (URL pública, ex. `https://credimob.seudominio.com`)
   - `POSTGRES_PASSWORD` e `MINIO_SECRET_KEY` (senhas fortes em produção)
5. Aba **Domínios**: aponte o domínio ao serviço **`app`**, porta **3000** (EasyPanel usa a rede interna; o compose só `expose`, sem `ports`).

O `docker-compose.yml` **não** usa `container_name` nem `ports` (exigência do EasyPanel). Desenvolvimento local usa `docker-compose.dev.yml` junto (`pnpm db:up`).

### Caminho 2 — App + serviços separados (se não há opção Compose)

1. Serviço `credimob` (App): em **Fonte**, **Dockerfile** = `Dockerfile` (não `docker-compose.yml`).
2. No mesmo projeto, crie **PostgreSQL**, **Redis** e **MinIO** (templates do EasyPanel).
3. Em **Ambiente** do `credimob`, configure `DATABASE_URL`, `REDIS_URL`, `MINIO_*` (hosts internos: `postgres`, `redis`, `minio`).
4. Crie outro App **workers** com o mesmo build, comando `pnpm workers`.
5. Variáveis obrigatórias no app — ver `.env.example`.

O pnpm 11 exige `allowBuilds` em `pnpm-workspace.yaml`. Sem isso o build falha com `ERR_PNPM_IGNORED_BUILDS`.

## Go-live (FASE 8)

Checklist antes de `NODE_ENV=production`:

```bash
pnpm go-live:check
pnpm db:migrate
pnpm db:catalog             # catálogo de documentos; sem usuários demo em produção
```

Subir o stack completo (app + workers + postgres + redis + minio):

```bash
pnpm stack:up
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
