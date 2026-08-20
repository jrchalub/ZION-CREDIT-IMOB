import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  bankStatements,
  bankTransactions,
  clients,
  creditCardAnalyses,
  debts,
  documentExtractedFields,
  documentTypes,
  documents,
  financialAnalyses,
  financialAnalysisSnapshots,
  financialCommitments,
  financingProcesses,
  financingSimulations,
  incomeAnalyses,
  incomeMonthRolls,
  paymentCapacitySnapshots,
  transactionClassifications,
} from "@/db/schema";
import { writeAuditLog } from "@/domain/audit/service";
import { createLogger } from "@/lib/logger";
import { classifyTransaction } from "../classifier/rules-v1";
import { computePaymentCapacity } from "../commitments/PaymentCapacity";
import {
  CLASSIFIER_RULES_VERSION,
  FINANCIAL_DISCLAIMER,
  INCOME_METHOD_VERSION,
  type TransactionCategory,
} from "../constants";
import { analyzeIncome, type TxForIncome } from "../income/IncomeAnalysis";
import { simulateFinancing } from "../simulation/SimulationEngine";
import {
  buildFinancialAnalysisSnapshot,
  hashSnapshotPayload,
} from "../snapshot/FinancialAnalysisSnapshot";

type RunInput = {
  processId: string;
  tenantId: string;
  correlationId?: string;
  userId?: string;
  rent?: number;
  otherCommitments?: number;
  simulationOverride?: {
    termMonths?: number;
    annualRatePct?: number;
    amortizationSystem?: "SAC" | "PRICE";
  };
};

function yearMonthFromPeriod(periodStart: string | null, periodEnd: string | null) {
  const raw = periodStart || periodEnd || "";
  const m = raw.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  return "unknown";
}

function num(value: string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Orchestrates FASE 4 analysis for a process.
 * Reads FASE 3 bank data; does not mutate document pipeline status.
 */
export async function runFinancialAnalysis(input: RunInput) {
  const log = createLogger("financial-analysis", input.correlationId);

  const [process] = await db
    .select()
    .from(financingProcesses)
    .where(
      and(
        eq(financingProcesses.id, input.processId),
        eq(financingProcesses.tenantId, input.tenantId),
      ),
    )
    .limit(1);

  if (!process) throw new Error("PROCESS_NOT_FOUND");

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, process.clientId), eq(clients.tenantId, input.tenantId)))
    .limit(1);

  const [analysis] = await db
    .insert(financialAnalyses)
    .values({
      tenantId: input.tenantId,
      processId: input.processId,
      status: "RUNNING",
      methodVersion: INCOME_METHOD_VERSION,
      ruleVersion: CLASSIFIER_RULES_VERSION,
      disclaimer: FINANCIAL_DISCLAIMER,
      correlationId: input.correlationId ?? null,
      startedAt: new Date(),
      createdByUserId: input.userId ?? null,
    })
    .returning();

  try {
    // Join via documents of this process (skip duplicates linked via duplicateOfDocumentId)
    const processDocs = await db
      .select({
        id: documents.id,
        duplicateOfDocumentId: documents.duplicateOfDocumentId,
      })
      .from(documents)
      .where(
        and(
          eq(documents.processId, input.processId),
          eq(documents.tenantId, input.tenantId),
        ),
      );
    const primaryDocs = processDocs.filter((d) => !d.duplicateOfDocumentId);
    const docIds = new Set(primaryDocs.map((d) => d.id));
    const documentsConsidered = primaryDocs.length;

    const processStatements = (
      await db
        .select()
        .from(bankStatements)
        .where(eq(bankStatements.tenantId, input.tenantId))
    ).filter((s) => docIds.has(s.documentId));

    const txForIncome: TxForIncome[] = [];

    for (const statement of processStatements) {
      const txs = await db
        .select()
        .from(bankTransactions)
        .where(
          and(
            eq(bankTransactions.bankStatementId, statement.id),
            eq(bankTransactions.tenantId, input.tenantId),
          ),
        );

      for (const tx of txs) {
        const [override] = await db
          .select()
          .from(transactionClassifications)
          .where(eq(transactionClassifications.bankTransactionId, tx.id))
          .limit(1);

        let category: TransactionCategory;
        let confidence: number;
        let ruleId: string | null;
        let source: string;

        if (override?.overridden) {
          category = override.category as TransactionCategory;
          confidence = Number(override.confidence ?? 1);
          ruleId = "human-override";
          source = "human";
        } else {
          const classified = classifyTransaction({
            description: tx.description ?? "",
            direction: (tx.direction as "CREDIT" | "DEBIT" | null) ?? null,
            existingCategory: tx.category,
          });
          category = classified.category;
          confidence = classified.confidence;
          ruleId = classified.ruleId;
          source = classified.source;

          await db
            .insert(transactionClassifications)
            .values({
              tenantId: input.tenantId,
              bankTransactionId: tx.id,
              category,
              confidence: String(confidence),
              source,
              ruleId,
              overridden: false,
            })
            .onConflictDoNothing({
              target: transactionClassifications.bankTransactionId,
            });

          await db
            .update(bankTransactions)
            .set({
              category,
              classificationConfidence: String(confidence),
            })
            .where(eq(bankTransactions.id, tx.id));
        }

        txForIncome.push({
          amount: num(tx.amount),
          direction: (tx.direction as "CREDIT" | "DEBIT" | null) ?? null,
          category,
          yearMonth: yearMonthFromPeriod(statement.periodStart, statement.periodEnd),
          bankStatementId: statement.id,
          periodStart: statement.periodStart,
          periodEnd: statement.periodEnd,
        });

        void ruleId;
        void source;
      }
    }

    const income = analyzeIncome(txForIncome);

    await db.insert(incomeAnalyses).values({
      tenantId: input.tenantId,
      processId: input.processId,
      financialAnalysisId: analysis.id,
      declaredIncome: client?.declaredIncome ?? null,
      estimatedIncome:
        income.estimatedIncome !== null ? String(income.estimatedIncome) : null,
      meanIncome: income.meanIncome !== null ? String(income.meanIncome) : null,
      medianIncome: income.medianIncome !== null ? String(income.medianIncome) : null,
      minIncome: income.minIncome !== null ? String(income.minIncome) : null,
      maxIncome: income.maxIncome !== null ? String(income.maxIncome) : null,
      variationPct: income.variationPct !== null ? String(income.variationPct) : null,
      recurrenceScore:
        income.recurrenceScore !== null ? String(income.recurrenceScore) : null,
      confidence: String(income.confidence),
      monthsAnalyzed: income.monthsAnalyzed,
      methodVersion: income.methodVersion,
      exclusions: income.exclusions,
    });

    if (income.months.length > 0) {
      await db.insert(incomeMonthRolls).values(
        income.months.map((m) => ({
          tenantId: input.tenantId,
          processId: input.processId,
          financialAnalysisId: analysis.id,
          bankStatementId: m.bankStatementId,
          yearMonth: m.yearMonth,
          periodStart: m.periodStart,
          periodEnd: m.periodEnd,
          grossCredits: String(m.grossCredits),
          ownTransfers: String(m.ownTransfers),
          loans: String(m.loans),
          refunds: String(m.refunds),
          otherExclusions: String(m.otherExclusions),
          validCredits: String(m.validCredits),
        })),
      );
    }

    // Credit card: from FATURA_CARTAO extracted fields + card payment txs
    const cardType = await db
      .select()
      .from(documentTypes)
      .where(eq(documentTypes.code, "FATURA_CARTAO"))
      .limit(1);
    let cardsTotal = 0;

    if (cardType[0]) {
      const cardDocs = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.processId, input.processId),
            eq(documents.tenantId, input.tenantId),
            eq(documents.documentTypeId, cardType[0].id),
          ),
        );

      for (const doc of cardDocs) {
        const fields = await db
          .select()
          .from(documentExtractedFields)
          .where(
            and(
              eq(documentExtractedFields.documentId, doc.id),
              eq(documentExtractedFields.tenantId, input.tenantId),
            ),
          );
        const map = new Map(fields.map((f) => [f.field, f.value]));
        const invoiceAmount = num(map.get("invoice_amount") ?? map.get("fatura") ?? "0");
        const creditLimit = num(map.get("credit_limit") ?? map.get("limite") ?? "0");
        const availableLimit = num(map.get("available_limit") ?? "0");
        const installmentsTotal = num(map.get("installments_total") ?? "0");
        const monthlyCommitment = invoiceAmount || installmentsTotal;
        cardsTotal += monthlyCommitment;

        await db.insert(creditCardAnalyses).values({
          tenantId: input.tenantId,
          processId: input.processId,
          financialAnalysisId: analysis.id,
          documentId: doc.id,
          issuer: map.get("issuer") ?? map.get("bank_name") ?? null,
          creditLimit: creditLimit ? String(creditLimit) : null,
          availableLimit: availableLimit ? String(availableLimit) : null,
          invoiceAmount: invoiceAmount ? String(invoiceAmount) : null,
          installmentsTotal: installmentsTotal ? String(installmentsTotal) : null,
          monthlyCommitment: String(monthlyCommitment),
        });
      }
    }

    // Infer card commitment from statement card payments if no fatura
    if (cardsTotal === 0) {
      const cardPayments = txForIncome
        .filter((t) => t.category === "CARD_PAYMENT" && t.direction === "DEBIT")
        .reduce((a, t) => a + Math.abs(t.amount), 0);
      if (cardPayments > 0 && income.monthsAnalyzed > 0) {
        cardsTotal = Math.round((cardPayments / income.monthsAnalyzed) * 100) / 100;
        await db.insert(creditCardAnalyses).values({
          tenantId: input.tenantId,
          processId: input.processId,
          financialAnalysisId: analysis.id,
          issuer: "Inferido de extratos",
          monthlyCommitment: String(cardsTotal),
          invoiceAmount: String(cardsTotal),
        });
      }
    }

    const processDebts = await db
      .select()
      .from(debts)
      .where(
        and(eq(debts.processId, input.processId), eq(debts.tenantId, input.tenantId)),
      );

    const debtsTotal = processDebts.reduce(
      (a, d) => a + num(d.monthlyInstallment),
      0,
    );

    // Link debts to this analysis run
    for (const debt of processDebts) {
      await db
        .update(debts)
        .set({ financialAnalysisId: analysis.id, updatedAt: new Date() })
        .where(eq(debts.id, debt.id));
    }

    const rent = input.rent ?? 0;
    const otherCommitments = input.otherCommitments ?? 0;
    const totalCommitments =
      Math.round((rent + debtsTotal + cardsTotal + otherCommitments) * 100) / 100;

    await db.insert(financialCommitments).values({
      tenantId: input.tenantId,
      processId: input.processId,
      financialAnalysisId: analysis.id,
      rent: String(rent),
      debtsTotal: String(debtsTotal),
      cardsTotal: String(cardsTotal),
      otherCommitments: String(otherCommitments),
      totalCommitments: String(totalCommitments),
    });

    const propertyValue = num(process.propertyValue);
    const downPayment = num(process.downPayment);
    const fgtsAmount = num(process.fgtsAmount);
    const financedAmount =
      num(process.financedAmount) ||
      Math.max(0, propertyValue - downPayment - fgtsAmount);
    const amortizationSystem =
      input.simulationOverride?.amortizationSystem ??
      process.amortizationSystem ??
      "PRICE";
    const termMonths = input.simulationOverride?.termMonths ?? 360;
    const annualRatePct = input.simulationOverride?.annualRatePct ?? 9.5;

    let simulation = null;
    let simulatedInstallment: number | null = null;

    if (propertyValue > 0 && financedAmount > 0) {
      simulation = simulateFinancing({
        propertyValue,
        downPayment,
        fgtsAmount,
        financedAmount,
        termMonths,
        annualRatePct,
        amortizationSystem,
      });
      simulatedInstallment =
        amortizationSystem === "SAC"
          ? simulation.firstInstallment
          : simulation.averageInstallment;

      await db.insert(financingSimulations).values({
        tenantId: input.tenantId,
        processId: input.processId,
        financialAnalysisId: analysis.id,
        propertyValue: String(simulation.propertyValue),
        downPayment: String(simulation.downPayment),
        fgtsAmount: String(simulation.fgtsAmount),
        financedAmount: String(simulation.financedAmount),
        termMonths: simulation.termMonths,
        annualRatePct: String(simulation.annualRatePct),
        amortizationSystem: simulation.amortizationSystem,
        firstInstallment: String(simulation.firstInstallment),
        lastInstallment: String(simulation.lastInstallment),
        averageInstallment: String(simulation.averageInstallment),
        totalInterest: String(simulation.totalInterest),
        scheduleSummary: simulation.scheduleSummary,
      });
    }

    const capacity = computePaymentCapacity({
      analyzedIncome: income.estimatedIncome,
      totalCommitments,
      simulatedInstallment,
      monthsAnalyzed: income.monthsAnalyzed,
      incomeConfidence: income.confidence,
      criticalFlags: income.monthsAnalyzed === 0 ? ["NO_BANK_STATEMENTS"] : [],
    });

    await db.insert(paymentCapacitySnapshots).values({
      tenantId: input.tenantId,
      processId: input.processId,
      financialAnalysisId: analysis.id,
      analyzedIncome:
        capacity.analyzedIncome !== null ? String(capacity.analyzedIncome) : null,
      totalCommitments: String(capacity.totalCommitments),
      simulatedInstallment:
        capacity.simulatedInstallment !== null
          ? String(capacity.simulatedInstallment)
          : null,
      estimatedCapacity:
        capacity.estimatedCapacity !== null
          ? String(capacity.estimatedCapacity)
          : null,
      commitmentPct:
        capacity.commitmentPct !== null ? String(capacity.commitmentPct) : null,
      indicative: capacity.indicative,
      flags: capacity.flags,
    });

    const finishedAt = new Date();
    const snapshotPayload = buildFinancialAnalysisSnapshot({
      processId: input.processId,
      processNumber: process.processNumber,
      analysisId: analysis.id,
      executedAt: finishedAt,
      documentsConsidered,
      statements: income.months.map((m) => ({
        yearMonth: m.yearMonth,
        periodStart: m.periodStart,
        periodEnd: m.periodEnd,
        grossCredits: m.grossCredits,
        ownTransfers: m.ownTransfers,
        loans: m.loans,
        refunds: m.refunds,
        validCredits: m.validCredits,
      })),
      declaredIncome: client?.declaredIncome ? num(client.declaredIncome) : null,
      analyzedIncome: income.estimatedIncome,
      meanIncome: income.meanIncome,
      medianIncome: income.medianIncome,
      commitments: {
        rent,
        debts: debtsTotal,
        cards: cardsTotal,
        other: otherCommitments,
        total: totalCommitments,
      },
      commitmentPct: capacity.commitmentPct,
      estimatedCapacity: capacity.estimatedCapacity,
      simulation: {
        system: simulation?.amortizationSystem ?? null,
        financedAmount: simulation?.financedAmount ?? null,
        installment: simulatedInstallment,
        termMonths: simulation?.termMonths ?? null,
        annualRatePct: simulation?.annualRatePct ?? null,
      },
      indicative: capacity.indicative,
      flags: capacity.flags,
    });
    const contentHash = hashSnapshotPayload(snapshotPayload);

    // Append-only immutable snapshot — never update this row later
    await db.insert(financialAnalysisSnapshots).values({
      tenantId: input.tenantId,
      processId: input.processId,
      financialAnalysisId: analysis.id,
      ruleVersion: snapshotPayload.ruleVersion,
      incomeMethodVersion: snapshotPayload.incomeMethodVersion,
      payload: snapshotPayload,
      contentHash,
    });

    await db
      .update(financialAnalyses)
      .set({
        status: "COMPLETED",
        indicative: capacity.indicative,
        ruleVersion: CLASSIFIER_RULES_VERSION,
        summary: {
          declaredIncome: client?.declaredIncome ?? null,
          estimatedIncome: income.estimatedIncome,
          meanIncome: income.meanIncome,
          medianIncome: income.medianIncome,
          debtsTotal,
          cardsTotal,
          rent,
          totalCommitments,
          simulatedInstallment,
          commitmentPct: capacity.commitmentPct,
          indicative: capacity.indicative,
          monthsAnalyzed: income.monthsAnalyzed,
          snapshotHash: contentHash,
          ruleVersion: CLASSIFIER_RULES_VERSION,
        },
        finishedAt,
        updatedAt: finishedAt,
      })
      .where(eq(financialAnalyses.id, analysis.id));

    // Cache on process (not a bank decision)
    await db
      .update(financingProcesses)
      .set({
        analyzedIncome:
          income.estimatedIncome !== null ? String(income.estimatedIncome) : null,
        paymentCapacity:
          capacity.estimatedCapacity !== null
            ? String(capacity.estimatedCapacity)
            : null,
        updatedAt: new Date(),
      })
      .where(eq(financingProcesses.id, input.processId));

    await writeAuditLog({
      tenantId: input.tenantId,
      userId: input.userId,
      action: "FINANCIAL_ANALYSIS_COMPLETED",
      entity: "process",
      entityId: input.processId,
      newValue: {
        analysisId: analysis.id,
        indicative: capacity.indicative,
        estimatedIncome: income.estimatedIncome,
        ruleVersion: CLASSIFIER_RULES_VERSION,
        snapshotHash: contentHash,
        disclaimer: FINANCIAL_DISCLAIMER,
      },
      correlationId: input.correlationId,
    });

    log.info("Financial analysis completed", {
      analysisId: analysis.id,
      indicative: capacity.indicative,
      snapshotHash: contentHash,
    });

    return {
      analysisId: analysis.id,
      indicative: capacity.indicative,
      disclaimer: FINANCIAL_DISCLAIMER,
      ruleVersion: CLASSIFIER_RULES_VERSION,
      snapshotHash: contentHash,
      snapshot: snapshotPayload,
      income,
      capacity,
      simulation,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    await db
      .update(financialAnalyses)
      .set({
        status: "FAILED",
        errorMessage: message,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(financialAnalyses.id, analysis.id));

    await writeAuditLog({
      tenantId: input.tenantId,
      userId: input.userId,
      action: "FINANCIAL_ANALYSIS_FAILED",
      entity: "process",
      entityId: input.processId,
      newValue: { analysisId: analysis.id, error: message },
      correlationId: input.correlationId,
    });

    throw error;
  }
}

export async function getLatestFinancialAnalysis(
  tenantId: string,
  processId: string,
) {
  const processDebts = await db
    .select()
    .from(debts)
    .where(and(eq(debts.processId, processId), eq(debts.tenantId, tenantId)));

  const [analysis] = await db
    .select()
    .from(financialAnalyses)
    .where(
      and(
        eq(financialAnalyses.processId, processId),
        eq(financialAnalyses.tenantId, tenantId),
      ),
    )
    .orderBy(desc(financialAnalyses.createdAt))
    .limit(1);

  if (!analysis) {
    return {
      analysis: null,
      income: null,
      months: [],
      cards: [],
      debts: processDebts,
      commitments: null,
      simulation: null,
      capacity: null,
      immutableSnapshot: null,
      disclaimer: FINANCIAL_DISCLAIMER,
    };
  }

  const [income] = await db
    .select()
    .from(incomeAnalyses)
    .where(eq(incomeAnalyses.financialAnalysisId, analysis.id))
    .limit(1);

  const months = await db
    .select()
    .from(incomeMonthRolls)
    .where(eq(incomeMonthRolls.financialAnalysisId, analysis.id));

  const cards = await db
    .select()
    .from(creditCardAnalyses)
    .where(eq(creditCardAnalyses.financialAnalysisId, analysis.id));

  const [commitments] = await db
    .select()
    .from(financialCommitments)
    .where(eq(financialCommitments.financialAnalysisId, analysis.id))
    .limit(1);

  const [simulation] = await db
    .select()
    .from(financingSimulations)
    .where(eq(financingSimulations.financialAnalysisId, analysis.id))
    .orderBy(desc(financingSimulations.createdAt))
    .limit(1);

  const [capacity] = await db
    .select()
    .from(paymentCapacitySnapshots)
    .where(eq(paymentCapacitySnapshots.financialAnalysisId, analysis.id))
    .limit(1);

  const [immutableSnapshot] = await db
    .select()
    .from(financialAnalysisSnapshots)
    .where(eq(financialAnalysisSnapshots.financialAnalysisId, analysis.id))
    .limit(1);

  return {
    analysis,
    income: income ?? null,
    months,
    cards,
    debts: processDebts,
    commitments: commitments ?? null,
    simulation: simulation ?? null,
    capacity: capacity ?? null,
    immutableSnapshot: immutableSnapshot ?? null,
    disclaimer: FINANCIAL_DISCLAIMER,
  };
}
