import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/domain/auth/service";
import { getProcess } from "@/domain/processes/service";
import { hasPermission } from "@/domain/rbac/permissions";
import { StatusBadge } from "@/components/status-badge";
import { ProcessActions } from "@/components/process-actions";
import { ProcessDocumentsPanel } from "@/components/process-documents-panel";
import { ProcessDocumentInboxPanel } from "@/components/process-document-inbox-panel";
import { ProcessAttendancePanel } from "@/components/process-attendance-panel";
import { ProcessDossierPanel } from "@/components/process-dossier-panel";
import { ProcessFinancialPanel } from "@/components/process-financial-panel";
import { ProcessOperationalPanel } from "@/components/process-operational-panel";
import { PortalAccessPanel } from "@/components/portal-access-panel";
import { ProcessPendenciesPanel } from "@/components/process-pendencies-panel";
import { ProcessIntegrationsPanel } from "@/components/process-integrations-panel";
import { ProcessFinancingPanel } from "@/components/process-financing-panel";
import {
  PROCESS_STATUS_LABELS,
  type ProcessStatus,
} from "@/domain/process/status-machine";
import {
  OPERATIONAL_STAGE_LABELS,
  toOperationalStage,
} from "@/modules/operations/workflow/operational-stages";
import { AppError } from "@/lib/api";
import { formatCpfDisplay, formatCurrency } from "@/lib/utils";

export default async function ProcessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("processes:read");
  const { id } = await params;

  let process;
  try {
    process = await getProcess(session, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  const canTransition = hasPermission(session.role, "processes:transition");
  const canFinancial = hasPermission(session.role, "financial:read");
  const canDecision = hasPermission(session.role, "decision:read");
  const canRespond = hasPermission(session.role, "pendencies:respond");
  const canWritePendencies = hasPermission(session.role, "pendencies:write");
  const canIntegrations = hasPermission(session.role, "integrations:read");
  const canFinancing = hasPermission(session.role, "financing:read");
  const canIssuePortal = hasPermission(session.role, "processes:write");
  const isCorrespondent = session.role === "CORRESPONDENTE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/processes" className="text-sm text-teal-800 hover:underline">
            ← {isCorrespondent ? "Meus processos" : "Processos"}
          </Link>
          <p className="mt-2 font-mono text-sm text-slate-500">
            {process.processNumber}
          </p>
          <h1 className="font-serif text-3xl">{process.clientName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            CPF {formatCpfDisplay(process.clientCpf)} · Perfil {process.incomeProfile}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={process.status as ProcessStatus} />
          {canIssuePortal ? (
            <Link
              href={`/processes/${process.id}/edit`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Editar dados
            </Link>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Etapa operacional:{" "}
        {
          OPERATIONAL_STAGE_LABELS[
            toOperationalStage(process.status as ProcessStatus)
          ]
        }
      </p>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="font-serif text-xl">
            {isCorrespondent ? "Cliente e operação" : "Resumo do processo"}
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Banco pretendido</dt>
              <dd>{process.intendedBank ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Envio a banco</dt>
              <dd>
                {process.institutionalChannel === "NENHUM"
                  ? "Não enviar"
                  : process.institutionalChannel === "CAIXA"
                    ? "Caixa"
                    : "Outro banco"}
                {process.institutionalSendOptIn ? " · autorizado pelo cliente" : " · sem autorização"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Sistema</dt>
              <dd>{process.amortizationSystem ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Valor do imóvel</dt>
              <dd>{formatCurrency(process.propertyValue)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Entrada</dt>
              <dd>{formatCurrency(process.downPayment)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Valor financiado</dt>
              <dd>{formatCurrency(process.financedAmount)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">FGTS</dt>
              <dd>{formatCurrency(process.fgtsAmount)}</dd>
            </div>
            {!isCorrespondent ? (
              <>
                <div>
                  <dt className="text-slate-500">Renda declarada</dt>
                  <dd>{formatCurrency(process.declaredIncome)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Renda analisada</dt>
                  <dd>{formatCurrency(process.analyzedIncome)}</dd>
                </div>
              </>
            ) : (
              <div>
                <dt className="text-slate-500">Renda declarada (cliente)</dt>
                <dd>{formatCurrency(process.declaredIncome)}</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {isCorrespondent
              ? "Portal operacional do correspondente. Análise financeira e decisão ficam com o analista."
              : "Indicadores internos de pré-análise. Sujeitos à análise da instituição financeira. O sistema não concede crédito."}
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl">Próxima ação</h2>
          <p className="mt-2 text-sm text-slate-600">
            Status atual: {PROCESS_STATUS_LABELS[process.status as ProcessStatus]}
          </p>
          {canTransition ? (
            <div className="mt-4">
              <ProcessActions
                processId={process.id}
                allowedTransitions={process.allowedTransitions}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Transições de status são feitas pela equipe de análise.
            </p>
          )}
        </section>
      </div>

      <ProcessOperationalPanel
        processId={process.id}
        canRespondPendencies={canRespond}
      />

      {canIssuePortal ? <PortalAccessPanel processId={process.id} /> : null}

      <ProcessPendenciesPanel
        processId={process.id}
        canWrite={canWritePendencies}
      />

      {canIntegrations ? (
        <ProcessIntegrationsPanel processId={process.id} />
      ) : null}

      {canFinancing ? (
        <ProcessFinancingPanel
          processId={process.id}
          processStatus={process.status}
          processNumber={process.processNumber}
        />
      ) : null}

      {canDecision ? <ProcessDossierPanel processId={process.id} /> : null}

      <ProcessAttendancePanel processId={process.id} />

      <ProcessDocumentInboxPanel processId={process.id} />

      <ProcessDocumentsPanel processId={process.id} />

      {canFinancial ? <ProcessFinancialPanel processId={process.id} /> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl">Histórico de status</h2>
        <ol className="mt-4 space-y-3">
          {process.statusHistory.map((item) => (
            <li key={item.id} className="border-l-2 border-teal-600 pl-4 text-sm">
              <p className="font-medium">
                {item.fromStatus
                  ? `${PROCESS_STATUS_LABELS[item.fromStatus as ProcessStatus]} → `
                  : ""}
                {PROCESS_STATUS_LABELS[item.toStatus as ProcessStatus]}
              </p>
              <p className="text-slate-500">
                {new Date(item.createdAt).toLocaleString("pt-BR")}
                {item.reason ? ` · ${item.reason}` : ""}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
