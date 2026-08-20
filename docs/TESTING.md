# Testing — ZION CREDIT

## Unitários (atuais)

```bash
pnpm test
```

- Validação/máscara de CPF
- Máquina de estados do processo
- Upload validation
- Confidence policy (auto / review / low)
- Mock AI scenarios (SUCCESS, LOW_CONFIDENCE, NAME_MISMATCH, PROVIDER_ERROR, …)
- Normalização de nomes (consistência)
- Classificador de lançamentos (rules-v1)
- Income analysis (exemplo Maio: 8750 → 4950 válidos; mediana multi-mês)
- Simulação SAC / PRICE
- Payment capacity + disclaimer
- Hardening FASE 4 (15 cenários) + snapshot imutável / hash
- Fatores explicáveis FASE 5 + DecisionSupportSnapshot + matriz (sem score)

## Mock controlável (sem custo de IA)

```bash
# .env
AI_PROVIDER=mock
MOCK_AI_SCENARIO=NAME_MISMATCH
```

Ou pelo filename: `rg-namemismatch.pdf`, `extrato-lowconf.pdf`, `doc-ocrerror.pdf`.

Reprocessamento local sem worker:

```http
POST /api/v1/documents/:id/reprocess
{ "mode": "sync" }
```

Com fila:

```bash
pnpm workers
```

## Integração / E2E (próximas fases)

- Upload + storage + worker end-to-end
- Fluxo completo cadastro → parecer

## Critério

Funcionalidade só está Done com código, migration, API, UI, authz, validação, logs e testes.
