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

## Não fazer

- Não usar Supabase
- Não usar Firebase
- Não versionar `.env` com secrets
- Não expor bucket de documentos como público
