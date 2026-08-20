import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  documentTypes,
  financingProcesses,
  incomeProfileDocumentRequirements,
  processChecklistItems,
} from "@/db/schema";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";

type Profile =
  | "AUTONOMO"
  | "CLT"
  | "MEI"
  | "EMPRESARIO"
  | "SERVIDOR_PUBLICO"
  | "APOSENTADO"
  | "PENSIONISTA"
  | "COMPOSICAO_RENDA"
  | "SOCIO_EMPRESA"
  | "PRODUTOR_RURAL";

function lastNMonths(n: number): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = n; i >= 1; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }
  return months;
}

function expandLabel(template: string | null, competence?: string) {
  if (!template) return "";
  return template.replace("{competence}", competence ?? "");
}

export async function generateChecklistForProcess(
  tenantId: string,
  processId: string,
  incomeProfile: Profile,
  options?: { hasCreditCard?: boolean },
) {
  const hasCreditCard = options?.hasCreditCard ?? true;

  const requirements = await db
    .select({
      requirement: incomeProfileDocumentRequirements,
      type: documentTypes,
    })
    .from(incomeProfileDocumentRequirements)
    .innerJoin(
      documentTypes,
      eq(documentTypes.id, incomeProfileDocumentRequirements.documentTypeId),
    )
    .where(
      and(
        eq(incomeProfileDocumentRequirements.incomeProfile, incomeProfile),
        eq(incomeProfileDocumentRequirements.active, true),
        eq(documentTypes.active, true),
      ),
    )
    .orderBy(asc(incomeProfileDocumentRequirements.sortOrder));

  const months3 = lastNMonths(3);
  const months2 = lastNMonths(2);
  const rows: Array<typeof processChecklistItems.$inferInsert> = [];

  for (const item of requirements) {
    const qty = item.requirement.quantity;
    const conditionKey = item.requirement.conditionKey;

    if (conditionKey === "HAS_CREDIT_CARD" && !hasCreditCard) {
      rows.push({
        tenantId,
        processId,
        documentTypeId: item.type.id,
        label: item.requirement.labelTemplate ?? item.type.name,
        requirement: "CONDICIONAL",
        status: "NAO_APLICAVEL",
        sortOrder: item.requirement.sortOrder,
        conditionKey,
        notes: "Cliente sem cartão de crédito declarado",
      });
      continue;
    }

    const competences =
      qty === 3 ? months3 : qty === 2 ? months2 : qty > 1 ? lastNMonths(qty) : [null];

    competences.forEach((competence, index) => {
      const label =
        expandLabel(item.requirement.labelTemplate, competence ?? undefined) ||
        (competence
          ? `${item.type.name} — ${competence}`
          : item.type.name);

      rows.push({
        tenantId,
        processId,
        documentTypeId: item.type.id,
        label,
        requirement: item.requirement.requirement,
        status: "PENDENTE",
        sortOrder: item.requirement.sortOrder * 10 + index,
        competence,
        conditionKey,
      });
    });
  }

  if (rows.length === 0) return [];

  return db.insert(processChecklistItems).values(rows).returning();
}

export async function ensureChecklistExists(
  session: SessionPayload,
  processId: string,
  options?: { hasCreditCard?: boolean },
) {
  const [process] = await db
    .select()
    .from(financingProcesses)
    .where(
      and(
        eq(financingProcesses.id, processId),
        eq(financingProcesses.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  if (!process) throw new AppError(404, "Processo não encontrado", "PROCESS_NOT_FOUND");

  const [existing] = await db
    .select({ value: count() })
    .from(processChecklistItems)
    .where(
      and(
        eq(processChecklistItems.processId, processId),
        eq(processChecklistItems.tenantId, session.tenantId),
      ),
    );

  if (Number(existing?.value ?? 0) > 0) {
    return listChecklist(session, processId);
  }

  await generateChecklistForProcess(
    session.tenantId,
    processId,
    process.incomeProfile as Profile,
    options,
  );

  return listChecklist(session, processId);
}

export async function listChecklist(session: SessionPayload, processId: string) {
  const items = await db
    .select({
      item: processChecklistItems,
      documentTypeCode: documentTypes.code,
      documentTypeName: documentTypes.name,
    })
    .from(processChecklistItems)
    .innerJoin(
      documentTypes,
      eq(documentTypes.id, processChecklistItems.documentTypeId),
    )
    .where(
      and(
        eq(processChecklistItems.processId, processId),
        eq(processChecklistItems.tenantId, session.tenantId),
      ),
    )
    .orderBy(asc(processChecklistItems.sortOrder));

  const totalApplicable = items.filter(
    (i) => i.item.status !== "NAO_APLICAVEL",
  ).length;
  const completed = items.filter(
    (i) =>
      i.item.status === "VALIDADO" ||
      i.item.status === "ENVIADO" ||
      i.item.status === "NAO_APLICAVEL",
  ).length;
  const validated = items.filter((i) => i.item.status === "VALIDADO").length;
  const pending = items.filter((i) => i.item.status === "PENDENTE").length;

  return {
    items: items.map((row) => ({
      ...row.item,
      documentTypeCode: row.documentTypeCode,
      documentTypeName: row.documentTypeName,
    })),
    progress: {
      totalApplicable,
      completed,
      validated,
      pending,
      percent:
        totalApplicable === 0
          ? 0
          : Math.round((completed / totalApplicable) * 100),
    },
  };
}

export async function markChecklistNotApplicable(
  session: SessionPayload,
  processId: string,
  checklistItemId: string,
  notes?: string,
) {
  const [updated] = await db
    .update(processChecklistItems)
    .set({
      status: "NAO_APLICAVEL",
      notes: notes ?? "Marcado como não aplicável",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(processChecklistItems.id, checklistItemId),
        eq(processChecklistItems.processId, processId),
        eq(processChecklistItems.tenantId, session.tenantId),
      ),
    )
    .returning();

  if (!updated) {
    throw new AppError(404, "Item de checklist não encontrado", "CHECKLIST_NOT_FOUND");
  }
  return updated;
}
