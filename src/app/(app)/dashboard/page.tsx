import Link from "next/link";
import { requirePermission } from "@/domain/auth/service";
import { hasPermission } from "@/domain/rbac/permissions";
import { getDashboardMetrics } from "@/domain/processes/service";
import {
  PROCESS_STATUS_LABELS,
  type ProcessStatus,
} from "@/domain/process/status-machine";
import { getProcessingDashboardMetrics } from "@/modules/document-intelligence/services/ReviewService";
import { getOperationalDashboard } from "@/modules/operations/services/OperationalDashboardService";
import {
  OPERATIONAL_STAGE_LABELS,
  type OperationalStage,
} from "@/modules/operations/workflow/operational-stages";

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-2 font-serif text-3xl text-slate-900">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requirePermission("dashboard:read");
  const metrics = await getDashboardMetrics(session);
  const isCorrespondent = session.role === "CORRESPONDENTE";
  const canOps = hasPermission(session.role, "operations:read");

  const funnel: Array<{ status: ProcessStatus; label: string }> = [
    { status: "NOVO", label: PROCESS_STATUS_LABELS.NOVO },
    { status: "EM_ANALISE", label: PROCESS_STATUS_LABELS.EM_ANALISE },
    { status: "APTO", label: PROCESS_STATUS_LABELS.APTO },
    { status: "ENVIADO_AO_BANCO", label: PROCESS_STATUS_LABELS.ENVIADO_AO_BANCO },
    { status: "APROVADO", label: PROCESS_STATUS_LABELS.APROVADO },
    { status: "CONTRATADO", label: PROCESS_STATUS_LABELS.CONTRATADO },
  ];

  const maxFunnel = Math.max(1, ...funnel.map((f) => metrics.byStatus[f.status]));

  if (isCorrespondent || !canOps) {
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.18em] text-teal-700 uppercase">
              Portal do correspondente
            </p>
            <h1 className="mt-1 font-serif text-3xl text-slate-900">
              Meus processos
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Visão limitada ao seu portfólio — sem análise financeira interna.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/clients/new"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Novo cliente
            </Link>
            <Link
              href="/processes/new"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Novo processo
            </Link>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Novos" value={metrics.totals.novos} />
          <Metric label="Em análise" value={metrics.totals.emAnalise} />
          <Metric label="Com pendência" value={metrics.totals.comPendencia} />
          <Metric label="Enviados ao banco" value={metrics.totals.enviadosAoBanco} />
          <Metric label="Aprovados" value={metrics.totals.aprovados} />
          <Metric label="Contratados" value={metrics.totals.contratados} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl">Funil do portfólio</h2>
          <div className="mt-4 space-y-3">
            {funnel.map((item) => {
              const value = metrics.byStatus[item.status];
              const width = `${Math.max(8, (value / maxFunnel) * 100)}%`;
              return (
                <div key={item.status}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                  <div className="h-2 rounded bg-slate-100">
                    <div className="h-2 rounded bg-teal-600" style={{ width }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  const processing = await getProcessingDashboardMetrics(session.tenantId);
  const ops = await getOperationalDashboard(session.tenantId);

  const agingRows = [
    { key: "d0_2", label: "0–2 dias", value: ops.aging.d0_2 },
    { key: "d3_5", label: "3–5 dias", value: ops.aging.d3_5 },
    { key: "d6_10", label: "6–10 dias", value: ops.aging.d6_10 },
    { key: "d10plus", label: "+10 dias", value: ops.aging.d10plus },
  ];
  const maxAging = Math.max(1, ...agingRows.map((r) => r.value));

  const stageOrder: OperationalStage[] = [
    "NOVO",
    "AGUARDANDO_DOCUMENTOS",
    "DOCUMENTACAO_EM_ANALISE",
    "PENDENCIA",
    "ANALISE_FINANCEIRA",
    "DOSSIE_PRONTO",
    "PARECER",
    "ENVIADO_PARA_INSTITUICAO",
    "EM_AVALIACAO",
    "APROVADO",
    "CONTRATACAO",
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-teal-700 uppercase">
            Operação
          </p>
          <h1 className="mt-1 font-serif text-3xl text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Filas, aging e SLA — sem aprovação bancária automática.
          </p>
        </div>
        <Link
          href="/processes"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Ver processos
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Processos novos" value={ops.totals.novos} />
        <Metric
          label="Documentação pendente"
          value={ops.totals.aguardandoDocumentos}
        />
        <Metric label="Em análise" value={ops.totals.emAnalise} />
        <Metric label="Dossiês prontos" value={ops.totals.dossiesProntos} />
        <Metric
          label="Aguardando analista"
          value={ops.totals.aguardandoAnalista}
        />
        <Metric label="Pendências abertas" value={ops.totals.openPendencies} />
        <Metric
          label="Enviados à instituição"
          value={ops.totals.enviadosInstituicao}
        />
        <Metric label="Contratados" value={ops.totals.contratacao} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl">Aging (última movimentação)</h2>
          <div className="mt-4 space-y-3">
            {agingRows.map((row) => {
              const width = `${Math.max(8, (row.value / maxAging) * 100)}%`;
              return (
                <div key={row.key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{row.label}</span>
                    <span className="font-medium">{row.value}</span>
                  </div>
                  <div className="h-2 rounded bg-slate-100">
                    <div
                      className="h-2 rounded bg-amber-600"
                      style={{ width }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl">SLA médio</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Documentação</dt>
              <dd className="font-serif text-2xl">
                {ops.sla.avgDocumentationHours}h
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Análise</dt>
              <dd className="font-serif text-2xl">{ops.sla.avgAnalysisHours}h</dd>
            </div>
            <div>
              <dt className="text-slate-500">Parecer</dt>
              <dd className="font-serif text-2xl">{ops.sla.avgReviewHours}h</dd>
            </div>
            <div>
              <dt className="text-slate-500">Total (abertura → decisão)</dt>
              <dd className="font-serif text-2xl">{ops.sla.avgTotalHours}h</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Métricas internas de operação. Tempo médio geral legado:{" "}
            {metrics.avgAnalysisHours.toFixed(1)}h.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl">Etapas operacionais</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stageOrder.map((stage) => (
            <div
              key={stage}
              className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 text-sm"
            >
              <span>{OPERATIONAL_STAGE_LABELS[stage]}</span>
              <span className="font-medium">{ops.byStage[stage]}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-xl">Document Intelligence</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pipeline OCR/IA — COMPLETED não significa documento VALIDADO.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Processados (pipeline)" value={processing.processed} />
          <Metric label="Em processamento" value={processing.processing} />
          <Metric label="Na fila" value={processing.queued} />
          <Metric label="Aguardando revisão" value={processing.requiresReview} />
          <Metric label="Falhos" value={processing.failed} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl">Funil de financiamento</h2>
        <div className="mt-4 space-y-3">
          {funnel.map((item) => {
            const value = metrics.byStatus[item.status];
            const width = `${Math.max(8, (value / maxFunnel) * 100)}%`;
            return (
              <div key={item.status}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-medium">{value}</span>
                </div>
                <div className="h-2 rounded bg-slate-100">
                  <div className="h-2 rounded bg-teal-600" style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
