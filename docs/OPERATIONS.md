# Operations & Integrations — ZION CREDIT (FASE 6)

**STATUS: PRODUCTION CLOSED**  
Freeze após incremento **6.6** (`IntegrationProvider`).  
Baseline operacional: este documento + [`PHASES.md`](./PHASES.md).

## Objetivo

Uso diário da operação — **sem** nova inteligência de crédito e **sem** envio institucional (FASE 7).

## Entregue (frozen)

| Incremento | Item |
|------------|------|
| 6.1 | SLA, NotificationService, dashboard/aging |
| 6.2 | Portal do Correspondente |
| 6.3 | Portal do Cliente `/portal/:token` |
| 6.4 | Pendências self-service |
| 6.5 | WhatsApp + deep link |
| **6.6** | **`IntegrationProvider` (Bureau / Bank read)** |

---

## FASE 6.6 — IntegrationProvider (FROZEN)

### Escopo

- Interface `IntegrationProvider` (`BUREAU` \| `BANK_READ`)
- Mock local + HTTP stub (`INTEGRATION_PROVIDER=mock|http`)
- Persistência `integration_calls` (resumo + auditoria)
- API/UI analista: consulta leitura apenas
- **Não** altera snapshots/fatores/parecer (FASE 5)
- **Não** submete proposta a banco (FASE 7 `FinancingProvider`)

### Env

| Var | Uso |
|-----|-----|
| `INTEGRATION_PROVIDER` | `mock` \| `http` |
| `BUREAU_PROVIDER_URL` / `TOKEN` | HTTP POST bureau |
| `BANK_READ_PROVIDER_URL` / `TOKEN` | HTTP POST leitura bancária |

### Permissões

`integrations:read` / `integrations:write` — ADMIN, GESTOR, ANALISTA (não correspondente).

### Freeze

Só bugfix em `src/modules/operations/integrations/**`. Trocar vendor = novo adapter HTTP, não domínio.

---

## Arquitetura (notificação + integração)

```
Evento operacional
      ↓
Service (pendency / integration)
      ↓
Provider interface
 ├── Mock
 └── HTTP stub / real URL
```

Núcleo de crédito (FASES 3–5) permanece congelado.

## Próxima fase

**FASE 7 — Institutional Financing** — baseline v1 em [`FINANCING_INTEGRATIONS.md`](./FINANCING_INTEGRATIONS.md) (`FinancingProvider` mock/HTTP, submit/track).
