# ZION CREDIT

Plataforma de **Análise Documental e Pré-Crédito Imobiliário** para operações de correspondente bancário/imobiliário.

> O sistema **não** concede crédito e **não** emite decisão bancária definitiva. Ele apoia a coleta, organização, análise documental/financeira e o parecer do analista.

## Stack oficial

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 16 + TypeScript |
| Backend | Next.js API / Server |
| Database | **PostgreSQL puro** (Docker) |
| ORM | Drizzle ORM |
| Cache / filas | Redis + BullMQ |
| Storage | MinIO (S3-compatible) |
| Auth | JWT + cookie httpOnly |
| Validation | Zod |
| Tests | Vitest |

**Não utilizamos Supabase, Firebase nem outros BaaS.**

## Setup rápido

Pré-requisitos: Node 20+, pnpm, Docker.

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

> Se o volume do Postgres foi criado com usuário antigo, use `pnpm infra:reset` (apaga volumes locais) e rode migrate/seed novamente.

Acesse: [http://localhost:3000](http://localhost:3000)

### Credenciais demo

- E-mail: `admin@zioncredit.demo`
- Senha: `Zion@Demo123`

### Infra local

| Serviço | Host |
|---------|------|
| PostgreSQL | `localhost:5433` |
| Redis | `localhost:6379` |
| MinIO API | `localhost:9000` |
| MinIO Console | `localhost:9001` |

## Scripts

| Script | Descrição |
|--------|-----------|
| `pnpm dev` | App local |
| `pnpm test` | Testes unitários |
| `pnpm db:up` | Sobe Postgres + Redis + MinIO |
| `pnpm db:migrate` | Aplica migrations |
| `pnpm db:seed` | Dados demo |
| `pnpm setup` | up + migrate + seed |
| `pnpm workers` | Worker BullMQ (document-processing) |

## Documentação

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [DATABASE.md](./docs/DATABASE.md)
- [API.md](./docs/API.md)
- [SECURITY.md](./docs/SECURITY.md)
- [LGPD.md](./docs/LGPD.md)
- [AI.md](./docs/AI.md)
- [DOCUMENT_INTELLIGENCE.md](./docs/DOCUMENT_INTELLIGENCE.md)
- [FINANCIAL_ANALYSIS.md](./docs/FINANCIAL_ANALYSIS.md)
- [CREDIT_DECISION_SUPPORT.md](./docs/CREDIT_DECISION_SUPPORT.md)
- [BASELINE_FASE_5.md](./docs/BASELINE_FASE_5.md)
- [OPERATIONS.md](./docs/OPERATIONS.md)
- [PHASES.md](./docs/PHASES.md)
- [TESTING.md](./docs/TESTING.md)
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md)

## Roadmap

1. FASE 1 — Foundation ✅ **PRODUCTION CLOSED**
2. FASE 2 — Documentos ✅ **PRODUCTION CLOSED**
3. FASE 3 — Document Intelligence ✅ **PRODUCTION CLOSED**
4. FASE 4 — Financeiro ✅ **PRODUCTION CLOSED**
5. FASE 5 — Credit Decision Support ✅ **PRODUCTION CLOSED** (ver `docs/BASELINE_FASE_5.md`)
6. FASE 6 — Operations & Integrations ✅ **PRODUCTION CLOSED**
7. FASE 7 — Institutional Financing Integrations ✅ **BASELINE v1** (ver `docs/FINANCING_INTEGRATIONS.md`)
