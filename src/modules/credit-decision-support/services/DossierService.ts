import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  bankStatements,
  bankTransactions,
  clients,
  creditAnalystReviews,
  creditCardAnalyses,
  debts,
  decisionFactors,
  decisionSupportSnapshots,
  documentConsistencyChecks,
  documentExtractedFields,
  documents,
  documentTypes,
  financialAnalyses,
  financialAnalysisSnapshots,
  financialCommitments,
  financingProcesses,
  financingSimulations,
  incomeAnalyses,
  incomeMonthRolls,
  paymentCapacitySnapshots,
  pendencies,
  processChecklistItems,
  processStatusHistory,
} from "@/db/schema";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";
import { CREDIT_SUPPORT_DISCLAIMER } from "../constants";

/**
 * Full explainable dossier for the analyst (FASE 5 product surface).
 */
export async function getProcessDossier(
  session: SessionPayload,
  processId: string,
) {
  const [process] = await db
    .select({
      id: financingProcesses.id,
      processNumber: financingProcesses.processNumber,
      status: financingProcesses.status,
      incomeProfile: financingProcesses.incomeProfile,
      propertyValue: financingProcesses.propertyValue,
      downPayment: financingProcesses.downPayment,
      financedAmount: financingProcesses.financedAmount,
      fgtsAmount: financingProcesses.fgtsAmount,
      amortizationSystem: financingProcesses.amortizationSystem,
      intendedBank: financingProcesses.intendedBank,
      analyzedIncome: financingProcesses.analyzedIncome,
      paymentCapacity: financingProcesses.paymentCapacity,
      clientId: financingProcesses.clientId,
      openedAt: financingProcesses.openedAt,
      clientName: clients.fullName,
      clientCpf: clients.cpf,
      clientProfession: clients.profession,
      clientOccupationType: clients.occupationType,
      declaredIncome: clients.declaredIncome,
      fgtsBalance: clients.fgtsBalance,
      phone: clients.phone,
      email: clients.email,
    })
    .from(financingProcesses)
    .innerJoin(clients, eq(financingProcesses.clientId, clients.id))
    .where(
      and(
        eq(financingProcesses.id, processId),
        eq(financingProcesses.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  if (!process) {
    throw new AppError(404, "Processo não encontrado", "PROCESS_NOT_FOUND");
  }

  const [decisionSnapshot] = await db
    .select()
    .from(decisionSupportSnapshots)
    .where(
      and(
        eq(decisionSupportSnapshots.processId, processId),
        eq(decisionSupportSnapshots.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(decisionSupportSnapshots.createdAt))
    .limit(1);

  const factors = decisionSnapshot
    ? await db
        .select()
        .from(decisionFactors)
        .where(eq(decisionFactors.decisionSupportSnapshotId, decisionSnapshot.id))
    : [];

  const [review] = decisionSnapshot
    ? await db
        .select()
        .from(creditAnalystReviews)
        .where(
          eq(creditAnalystReviews.decisionSupportSnapshotId, decisionSnapshot.id),
        )
        .orderBy(desc(creditAnalystReviews.createdAt))
        .limit(1)
    : [null];

  const reviewsHistory = await db
    .select()
    .from(creditAnalystReviews)
    .where(
      and(
        eq(creditAnalystReviews.processId, processId),
        eq(creditAnalystReviews.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(creditAnalystReviews.createdAt));

  const [financialSnapshot] = await db
    .select()
    .from(financialAnalysisSnapshots)
    .where(
      and(
        eq(financialAnalysisSnapshots.processId, processId),
        eq(financialAnalysisSnapshots.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(financialAnalysisSnapshots.createdAt))
    .limit(1);

  const [financialAnalysis] = await db
    .select()
    .from(financialAnalyses)
    .where(
      and(
        eq(financialAnalyses.processId, processId),
        eq(financialAnalyses.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(financialAnalyses.createdAt))
    .limit(1);

  const [income] = financialAnalysis
    ? await db
        .select()
        .from(incomeAnalyses)
        .where(eq(incomeAnalyses.financialAnalysisId, financialAnalysis.id))
        .limit(1)
    : [null];

  const months = financialAnalysis
    ? await db
        .select()
        .from(incomeMonthRolls)
        .where(eq(incomeMonthRolls.financialAnalysisId, financialAnalysis.id))
    : [];

  const [commitments] = financialAnalysis
    ? await db
        .select()
        .from(financialCommitments)
        .where(eq(financialCommitments.financialAnalysisId, financialAnalysis.id))
        .limit(1)
    : [null];

  const cards = financialAnalysis
    ? await db
        .select()
        .from(creditCardAnalyses)
        .where(eq(creditCardAnalyses.financialAnalysisId, financialAnalysis.id))
    : [];

  const [capacity] = financialAnalysis
    ? await db
        .select()
        .from(paymentCapacitySnapshots)
        .where(eq(paymentCapacitySnapshots.financialAnalysisId, financialAnalysis.id))
        .limit(1)
    : [null];

  const [simulation] = await db
    .select()
    .from(financingSimulations)
    .where(
      and(
        eq(financingSimulations.processId, processId),
        eq(financingSimulations.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(financingSimulations.createdAt))
    .limit(1);

  const processDebts = await db
    .select()
    .from(debts)
    .where(
      and(eq(debts.processId, processId), eq(debts.tenantId, session.tenantId)),
    );

  const checklist = await db
    .select({
      id: processChecklistItems.id,
      label: processChecklistItems.label,
      status: processChecklistItems.status,
      requirement: processChecklistItems.requirement,
      documentTypeCode: documentTypes.code,
      documentTypeName: documentTypes.name,
    })
    .from(processChecklistItems)
    .innerJoin(
      documentTypes,
      eq(processChecklistItems.documentTypeId, documentTypes.id),
    )
    .where(
      and(
        eq(processChecklistItems.processId, processId),
        eq(processChecklistItems.tenantId, session.tenantId),
      ),
    );

  const required = checklist.filter((c) => c.requirement === "OBRIGATORIO");
  const validatedRequired = required.filter((c) => c.status === "VALIDADO");
  const documentationPct =
    required.length === 0
      ? 100
      : Math.round((validatedRequired.length / required.length) * 100);

  const docs = await db
    .select({
      id: documents.id,
      originalFilename: documents.originalFilename,
      status: documents.status,
      documentTypeCode: documentTypes.code,
      classificationConfidence: documents.classificationConfidence,
      duplicateOfDocumentId: documents.duplicateOfDocumentId,
    })
    .from(documents)
    .innerJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
    .where(
      and(eq(documents.processId, processId), eq(documents.tenantId, session.tenantId)),
    );

  const evidenceFields = await db
    .select({
      id: documentExtractedFields.id,
      documentId: documentExtractedFields.documentId,
      field: documentExtractedFields.field,
      value: documentExtractedFields.value,
      confidence: documentExtractedFields.confidence,
      page: documentExtractedFields.page,
      evidenceText: documentExtractedFields.evidenceText,
    })
    .from(documentExtractedFields)
    .innerJoin(documents, eq(documentExtractedFields.documentId, documents.id))
    .where(
      and(eq(documents.processId, processId), eq(documents.tenantId, session.tenantId)),
    )
    .limit(100);

  const statements = await db
    .select()
    .from(bankStatements)
    .innerJoin(documents, eq(bankStatements.documentId, documents.id))
    .where(
      and(eq(documents.processId, processId), eq(documents.tenantId, session.tenantId)),
    );

  const statementRows = statements.map((s) => s.bank_statements);
  const txs =
    statementRows.length > 0
      ? await db
          .select()
          .from(bankTransactions)
          .where(eq(bankTransactions.tenantId, session.tenantId))
      : [];
  const statementIds = new Set(statementRows.map((s) => s.id));
  const processTxs = txs.filter((t) => statementIds.has(t.bankStatementId));

  const openPendencies = await db
    .select()
    .from(pendencies)
    .where(
      and(
        eq(pendencies.processId, processId),
        eq(pendencies.tenantId, session.tenantId),
        inArray(pendencies.status, [
          "OPEN",
          "SUBMITTED",
          "UNDER_REVIEW",
          "REJECTED",
        ]),
      ),
    );

  const [consistency] = await db
    .select()
    .from(documentConsistencyChecks)
    .where(
      and(
        eq(documentConsistencyChecks.processId, processId),
        eq(documentConsistencyChecks.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(documentConsistencyChecks.createdAt))
    .limit(1);

  const statusHistory = await db
    .select()
    .from(processStatusHistory)
    .where(
      and(
        eq(processStatusHistory.processId, processId),
        eq(processStatusHistory.tenantId, session.tenantId),
      ),
    )
    .orderBy(desc(processStatusHistory.createdAt));

  const audit = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      createdAt: auditLogs.createdAt,
      userId: auditLogs.userId,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tenantId, session.tenantId),
        eq(auditLogs.entityId, processId),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);

  const finPayload = (financialSnapshot?.payload ?? null) as Record<
    string,
    unknown
  > | null;

  return {
    identification: {
      processNumber: process.processNumber,
      processId: process.id,
      status: process.status,
      clientName: process.clientName,
      clientCpf: process.clientCpf,
      phone: process.phone,
      email: process.email,
      openedAt: process.openedAt,
      intendedBank: process.intendedBank,
    },
    professionalProfile: {
      incomeProfile: process.incomeProfile,
      profession: process.clientProfession,
      occupationType: process.clientOccupationType,
    },
    documentation: {
      percentComplete: documentationPct,
      checklist,
      documents: docs,
    },
    income: {
      declared: process.declaredIncome,
      analyzed: finPayload?.analyzedIncome ?? process.analyzedIncome,
      mean: income?.meanIncome ?? finPayload?.meanIncome ?? null,
      median: income?.medianIncome ?? finPayload?.medianIncome ?? null,
      method: "MEDIANA",
      months,
      exclusions: finPayload?.exclusions ?? income?.exclusions ?? null,
      ruleVersion: financialSnapshot?.ruleVersion ?? null,
      financialSnapshotId: financialSnapshot?.id ?? null,
    },
    banking: {
      statements: statementRows,
      transactionsSample: processTxs.slice(0, 40),
    },
    cards,
    debts: processDebts,
    commitments: commitments ?? finPayload?.commitments ?? null,
    capacity: {
      estimated:
        capacity?.estimatedCapacity ?? finPayload?.estimatedCapacity ?? process.paymentCapacity,
      commitmentPct: capacity?.commitmentPct ?? finPayload?.commitmentPct ?? null,
      indicative: capacity?.indicative ?? finPayload?.indicative ?? null,
      flags: capacity?.flags ?? finPayload?.flags ?? [],
    },
    simulation: simulation
      ? {
          propertyValue: simulation.propertyValue,
          downPayment: simulation.downPayment,
          fgtsAmount: simulation.fgtsAmount,
          financedAmount: simulation.financedAmount,
          termMonths: simulation.termMonths,
          annualRatePct: simulation.annualRatePct,
          amortizationSystem: simulation.amortizationSystem,
          firstInstallment: simulation.firstInstallment,
          averageInstallment: simulation.averageInstallment,
        }
      : {
          propertyValue: process.propertyValue,
          downPayment: process.downPayment,
          fgtsAmount: process.fgtsAmount,
          financedAmount: process.financedAmount,
          amortizationSystem: process.amortizationSystem,
        },
    consistency: {
      score: consistency?.consistencyScore ?? null,
      issues: consistency?.issues ?? [],
      factors: consistency?.factors ?? [],
    },
    pendencies: {
      openCount: openPendencies.length,
      items: openPendencies,
    },
    factors: {
      positive: factors.filter((f) => f.kind === "POSITIVO"),
      attention: factors.filter((f) => f.kind === "ATENCAO"),
      pendencies: factors.filter((f) => f.kind === "PENDENCIA"),
      all: factors,
    },
    matrix: decisionSnapshot?.matrix ?? [],
    evidence: evidenceFields,
    history: statusHistory,
    audit,
    decisionSupport: decisionSnapshot
      ? {
          id: decisionSnapshot.id,
          rulesVersion: decisionSnapshot.rulesVersion,
          version: decisionSnapshot.version,
          indicativeResult: decisionSnapshot.indicativeResult,
          contentHash: decisionSnapshot.contentHash,
          financialSnapshotId: decisionSnapshot.financialSnapshotId,
          createdAt: decisionSnapshot.createdAt,
        }
      : null,
    review: review ?? null,
    reviewsHistory,
    disclaimer: CREDIT_SUPPORT_DISCLAIMER,
    invariants: {
      aiDoesNotApprove: true,
      aiDoesNotReject: true,
      financialSnapshotImmutable: true,
      dossierReproducible: true,
      factorsHaveOrigin: factors.every((f) => Boolean(f.originType)),
      humanDecisionRequired: true,
      multiTenantIsolated: true,
    },
  };
}
