# Credit Decision Support — ZION CREDIT (FASE 5)

> **STATUS: PRODUCTION CLOSED** — baseline em [`BASELINE_FASE_5.md`](./BASELINE_FASE_5.md).  
> Não evoluir operação/WhatsApp/portais aqui. FASE 6 em [`OPERATIONS.md`](./OPERATIONS.md).

## Princípio

Não é caixa-preta de score. Cada fator aponta para origem/evidência.

```text
DECISÃO → FATOR → SNAPSHOT → DADO FINANCEIRO → DOCUMENTO → PÁGINA → EVIDÊNCIA
```

## Componentes

| Componente | Tabela / path |
|------------|---------------|
| DecisionSupportSnapshot | `decision_support_snapshots` (imutável, `credit-support-v1`) |
| Decision Factors | `decision_factors` (POSITIVO / ATENCAO / PENDENCIA + origin) |
| Matriz | payload.matrix — OK / ATENCAO / CRITICO / NA (sem score) |
| Dossiê | `GET/POST /api/v1/processes/:id/dossier` + UI `/processes/:id/dossier` |
| Parecer | `credit_analyst_reviews` + `/analyst-review` |

## Indicativo (não é aprovação bancária)

- `FAVORAVEL`
- `REQUER_ANALISE`
- `DESFAVORAVEL`

## Parecer humano

Status: `PENDING → IN_REVIEW → APPROVED | REJECTED | RETURNED`

Justificativa obrigatória. Vinculado ao snapshot. Histórico não sobrescrito.

## Invariantes

- IA não aprova / não reprova
- Snapshot financeiro imutável
- Dossiê reproduzível
- Fatores possuem origem
- Decisão possui responsável + justificativa
- Multi-tenant isolado

## Disclaimer

> Resultado de suporte à decisão interna. Não representa aprovação ou reprovação de crédito por instituição financeira. A decisão final é sempre do analista humano.
