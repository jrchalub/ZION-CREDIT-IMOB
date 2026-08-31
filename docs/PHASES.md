# Phases — ZION CREDIT

## FASE 1 — Foundation

**STATUS: PRODUCTION CLOSED**

## FASE 2 — Document Management

**STATUS: PRODUCTION CLOSED**

## FASE 3 — Document Intelligence

**STATUS: PRODUCTION CLOSED**

Baseline: Mock OCR/AI, evidências, worker, human-in-the-loop.  
Freeze: `src/modules/document-intelligence/**` — só bugfix.

## FASE 4 — Financial Analysis

**STATUS: PRODUCTION CLOSED**

Baseline: renda defensável (mediana), snapshot imutável `rules-v1`.  
Freeze: `src/modules/financial-analysis/**` — só bugfix.

## FASE 5 — Credit Decision Support

**STATUS: PRODUCTION CLOSED**

Baseline completo: [`BASELINE_FASE_5.md`](./BASELINE_FASE_5.md)

### Freeze

Alterações em `src/modules/credit-decision-support/**` apenas para **bugfix crítico**.

## FASE 6 — Operations & Integrations

**STATUS: PRODUCTION CLOSED**

Baseline: [`OPERATIONS.md`](./OPERATIONS.md)

Incrementos: 6.1 núcleo · 6.2 correspondente · 6.3 portal cliente · 6.4 pendências · 6.5 WhatsApp · **6.6 IntegrationProvider**

### Freeze

`src/modules/operations/**` — só bugfix crítico.  
Não reescrever crédito/IA nesta fase.

## FASE 7 — Institutional Financing Integrations

**STATUS: BASELINE v1 + multi banking correspondents**

`FinancingProvider` multi-instituição (Caixa mock/HTTP) com **correspondente bancário obrigatório por submissão** — ver [`FINANCING_INTEGRATIONS.md`](./FINANCING_INTEGRATIONS.md).

## FASE 7.1 — SDK Caixa (opcional por cliente)

**STATUS: BASELINE v1**

Envio à Caixa **não é obrigatório**. Camadas:

1. Escritório liga/desliga o canal em **Configurações** (`settings.caixaSdkEnabled`)
2. Cliente escolhe no processo: não enviar / Caixa / outro banco + autorização
3. Ambiente: `CAIXA_SDK_ENABLED` + credenciais para o adapter HTTP (sem npm oficial)

Sem autorização, o dossiê fica só no Zion. Outro banco não chama o SDK Caixa.

## FASE 8 — Go-live operacional

**STATUS: BASELINE v1**

Produção operacional. SDK Caixa é **opt-in** (FASE 7.1), não automático.

| Item | Comportamento |
|------|----------------|
| OCR | `OCR_PROVIDER=openai` (ou herda `AI_PROVIDER`) — imagens via vision; PDF com texto nativo; PDF escaneado sem rasterizer → revisão humana |
| Workers | Processo `pnpm workers` com SIGTERM/SIGINT |
| Health | `GET /api/v1/health/live` (público) · `GET /api/v1/health/ready` (público, 503 se Postgres/Redis falhar) · `GET /api/v1/health` autenticado |
| Login | Rate-limit Redis (`LOGIN_RATE_LIMIT_*`) |
| Seed | Em `NODE_ENV=production` só catálogo, sem usuários demo (`ALLOW_DEMO_SEED=true` para forçar) |
| CRM | `POST /api/v1/webhooks/crm` → `process_attendance` (não envia ao banco) |
| Deploy | `Dockerfile` + `docker-compose.prod.yml` · `pnpm go-live:check` |

## Roadmap

| Fase | Nome | Status |
|------|------|--------|
| 1 | Foundation | **PRODUCTION CLOSED** |
| 2 | Document Management | **PRODUCTION CLOSED** |
| 3 | Document Intelligence | **PRODUCTION CLOSED** |
| 4 | Financial Analysis | **PRODUCTION CLOSED** |
| 5 | Credit Decision Support | **PRODUCTION CLOSED** |
| 6 | Operations & Integrations | **PRODUCTION CLOSED** |
| 7 | Institutional Financing Integrations | **BASELINE v1** |
| 7.1 | SDK Caixa (opcional por cliente) | **BASELINE v1** |
| 8 | Go-live operacional | **BASELINE v1** |
