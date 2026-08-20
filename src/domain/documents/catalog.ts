import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  documentTypes,
  financingProcesses,
  incomeProfileDocumentRequirements,
} from "@/db/schema";
import {
  ANALYSIS_DOCUMENT_TYPES,
  CAIXA_ANNEXES,
  INCOME_PROFILES,
  annexLabel,
} from "./caixa-annex-catalog";
import { generateChecklistForProcess } from "./checklist";

export async function upsertDocumentCatalog() {
  const existing = await db.select().from(documentTypes);
  const byCode = new Map(existing.map((row) => [row.code, row]));

  for (const annex of CAIXA_ANNEXES) {
    const values = {
      name: annexLabel(annex),
      description: annex.description,
      category: annex.category,
      allowsMultiple: annex.allowsMultiple ?? false,
      requiresCompetence: false,
      active: true,
      updatedAt: new Date(),
    };
    const current = byCode.get(annex.code);
    if (current) {
      await db
        .update(documentTypes)
        .set(values)
        .where(eq(documentTypes.id, current.id));
    } else {
      const [inserted] = await db
        .insert(documentTypes)
        .values({ code: annex.code, ...values })
        .returning();
      byCode.set(annex.code, inserted);
    }
  }

  for (const type of ANALYSIS_DOCUMENT_TYPES) {
    const values = {
      name: type.name,
      description: type.description,
      category: type.category,
      allowsMultiple: type.allowsMultiple,
      requiresCompetence: type.requiresCompetence,
      active: true,
      updatedAt: new Date(),
    };
    const current = byCode.get(type.code);
    if (current) {
      await db
        .update(documentTypes)
        .set(values)
        .where(eq(documentTypes.id, current.id));
    } else {
      const [inserted] = await db
        .insert(documentTypes)
        .values({ code: type.code, ...values })
        .returning();
      byCode.set(type.code, inserted);
    }
  }

  const refreshed = await db.select().from(documentTypes);
  const typesByCode = Object.fromEntries(refreshed.map((row) => [row.code, row]));

  await db.delete(incomeProfileDocumentRequirements);

  const requirementRows = INCOME_PROFILES.flatMap((incomeProfile) =>
    CAIXA_ANNEXES.map((annex) => ({
      incomeProfile,
      documentTypeId: typesByCode[annex.code]!.id,
      requirement: annex.requirement,
      quantity: 1,
      sortOrder: annex.annexNumber * 10,
      labelTemplate: annexLabel(annex),
      conditionKey: annex.conditionKey ?? null,
      active: true,
    })),
  );

  await db.insert(incomeProfileDocumentRequirements).values(requirementRows);

  return typesByCode;
}

export async function syncAllProcessChecklists() {
  const processes = await db
    .select({
      id: financingProcesses.id,
      tenantId: financingProcesses.tenantId,
      incomeProfile: financingProcesses.incomeProfile,
    })
    .from(financingProcesses);

  for (const process of processes) {
    await generateChecklistForProcess(
      process.tenantId,
      process.id,
      process.incomeProfile,
    );
  }

  return processes.length;
}
