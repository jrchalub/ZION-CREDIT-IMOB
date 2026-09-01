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

6. **Implantar** — serviços esperados: `postgres`, `redis`, `minio`, `minio-init`, `app`, `workers`.

Logs normais no primeiro deploy: `Migrations complete`, `Ready in …ms`, workers `All workers started`. Os `NOTICE` do Postgres (truncated identifier) são avisos, não erro.

### Domínios (site não abre)

No modal **Atualizar Domínio** (Compose `credimob`):

| Campo | Valor |
|-------|--------|
| HTTPS | Ligado |
| Host | `credimob.zionsoft.com.br` |
| Caminho | `/` |
| Protocolo | `HTTP` |
| **Porta** | **`3000`** |
| Caminho (destino) | `/` |
| **Compose Service** | **`app`** |

**Aba SSL** (obrigatório para domínio próprio): escolha o resolvedor Let's Encrypt do servidor (ex. `letsencrypt`). Sem certificado, o browser pode falhar ou ficar em branco.

**DNS** no registrador (`zionsoft.com.br`):

| Tipo | Nome | Valor |
|------|------|--------|
| A | `credimob` | IP público do VPS EasyPanel |

Confirme em [dnschecker.org](https://dnschecker.org) que `credimob.zionsoft.com.br` aponta ao IP certo.

**Ambiente** (compose):

```env
APP_URL=https://credimob.zionsoft.com.br
AUTH_SECRET=<32+ caracteres aleatórios>
ALLOW_DEMO_SEED=true
```

`ALLOW_DEMO_SEED=true` só na **primeira** implantação ou quando precisar recriar dados demo; remova depois.

Salvar domínio → **Implantar** (rebuild após push do código).

**Testes:**

1. `https://credimob.zionsoft.com.br/api/v1/health/live` → JSON `ok: true`
2. `https://credimob.zionsoft.com.br/login` → formulário de login

Se o domínio EasyPanel (`*.easypanel.host`) abre mas o customizado não → problema é **DNS ou SSL**, não o app.

Nos logs do serviço `app`, deve aparecer `Ready` e **sem** erro após `next start`.

### Depois que subiu

1. **Domínios** → serviço `app`, porta **3000**.
2. **Ambiente**: `AUTH_SECRET`, `APP_URL` (URL pública com `https://`).
3. **Login / seed demo**: em produção o entrypoint só sincroniza o **catálogo** de documentos — **não** cria tenant nem usuários. Para o primeiro login de teste:
   - Na aba **Ambiente** do compose, adicione `ALLOW_DEMO_SEED=true`
   - **Implantar** (reinicia o `app`; o seed roda no startup)
   - Nos logs do `app`, confirme mensagens como `Tenant data` / `admin@zioncredit.demo` (não só `catálogo sincronizado`)
   - Credenciais: `admin@zioncredit.demo` / `Zion@Demo123`
   - Depois do primeiro login de teste, remova `ALLOW_DEMO_SEED` ou defina `false` e redeploy (segurança)
4. **Health**: `https://seudominio/api/v1/health/live` (público).

Aviso Redis `Memory overcommit` no host: opcional `sysctl vm.overcommit_memory=1` no VPS (não bloqueia o app).

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
