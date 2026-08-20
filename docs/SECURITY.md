# Security — ZION CREDIT

## Controles atuais

- Senhas bcrypt (cost 12)
- JWT em cookie `httpOnly` / `SameSite=Lax` / `Secure` em produção
- RBAC por papel
- Isolamento por tenant (tenant do token, nunca do body)
- Validação Zod
- Upload: tamanho máximo, MIME real (`file-type`), extensão allowlist, hash SHA-256, anti path traversal
- Documentos privados no MinIO (sem `/public`)
- Visualização apenas com signed URL temporária (~120s)
- Audit log com redação de campos sensíveis

## Infra

- PostgreSQL self-hosted
- Redis (cache/filas/rate-limit futuro)
- MinIO S3-compatible

## Sem BaaS

Não há Supabase Auth/Storage/DB nem Firebase.
