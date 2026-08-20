# Financial Analysis — ZION CREDIT (FASE 4)

**STATUS: IN PROGRESS** — ver [`PHASES.md`](./PHASES.md).

## Snapshot imutável

Cada execução grava `financial_analysis_snapshots` (append-only):

- `ruleVersion` (ex.: `rules-v1`)
- `incomeMethodVersion` (ex.: `income-v1`)
- `payload` congelado (renda, exclusões, simulação, indicativo)
- `contentHash` SHA-256

**Reprocessar** cria um **novo** snapshot. Históricos não mudam se as regras forem para `rules-v2`.

## Princípio

Não somar créditos brutos como renda.

```text
créditos totais
− transferências próprias
− empréstimos
− estornos
= créditos potencialmente válidos (mês)
```

Agregado: média, mediana, variação, recorrência, confiança.  
**Renda analisada padrão = mediana.**

## Módulos

| Módulo | Path |
|--------|------|
| Transaction Classification | `src/modules/financial-analysis/classifier/` |
| Income Analysis | `src/modules/financial-analysis/income/` |
| Simulation SAC/PRICE | `src/modules/financial-analysis/simulation/` |
| Payment capacity | `src/modules/financial-analysis/commitments/` |
| Orchestrator | `src/modules/financial-analysis/services/` |

## Fronteira com FASE 3

FASE 4 **lê** `bank_statements` / `bank_transactions`.  
Não altera `documents.status` nem o pipeline OCR/IA.

## Indicativo interno

| Indicativo | Critério |
|------------|----------|
| FAVORAVEL | comprometimento ≤ 30% e confiança/meses ok |
| NECESSITA_ANALISE | 30–40% ou poucos meses / baixa confiança |
| DESFAVORAVEL | > 40% ou sem renda analisada |

Comprometimento = parcela simulada / renda analisada.

## Disclaimer (obrigatório)

> Resultado de pré-análise interna. Não representa aprovação ou reprovação de crédito por instituição financeira.

## API

| Método | Rota |
|--------|------|
| GET/POST | `/api/v1/processes/:id/financial-analysis` |
| GET/POST | `/api/v1/processes/:id/debts` |
| PATCH | `/api/v1/bank-transactions/:id/classification` |

POST body: `{ mode: "sync" | "enqueue", rent?, otherCommitments?, simulationOverride? }`

## Worker

```bash
pnpm workers
```

Fila: `financial-analysis`.

## UI

Painel **Pré-análise financeira** na página do processo.
