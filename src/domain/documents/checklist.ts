import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  documentTypes,
  documents,
  financingProcesses,
  incomeProfileDocumentRequirements,
  processChecklistItems,
} from "@/db/schema";
import { loadProcessForSession } from "@/domain/access/scope";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";
import { annexMultipleHint, getAnnexByCode, type IncomeProfile } from "./caixa-annex-catalog";
import { isExpiredOn } from "./document-validity";

type Profile = IncomeProfile;

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

const RETIRED_NOTES = "Catálogo Caixa — item substituído pelos anexos oficiais";

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

  const existing = await db
    .select()
    .from(processChecklistItems)
    .where(
      and(
        eq(processChecklistItems.processId, processId),
        eq(processChecklistItems.tenantId, tenantId),
      ),
    );

  const existingByType = new Map<string, typeof existing>();
  for (const item of existing) {
    const list = existingByType.get(item.documentTypeId) ?? [];
    list.push(item);
    existingByType.set(item.documentTypeId, list);
  }

  const catalogTypeIds = new Set(requirements.map((item) => item.type.id));
  const months3 = lastNMonths(3);
  const months2 = lastNMonths(2);

  for (const item of requirements) {
    const qty = item.requirement.quantity;
    const conditionKey = item.requirement.conditionKey;
    const current = existingByType.get(item.type.id) ?? [];
    const live = current.filter((row) => row.status !== "NAO_APLICAVEL");
    const keptNotApplicable = current.find(
      (row) =>
        row.status === "NAO_APLICAVEL" && row.notes !== RETIRED_NOTES,
    );

    if (conditionKey === "HAS_CREDIT_CARD" && !hasCreditCard) {
      if (live.length === 0) {
        await db.insert(processChecklistItems).values({
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
      }
      continue;
    }

    const label =
      expandLabel(item.requirement.labelTemplate) || item.type.name;

    if (qty <= 1) {
      if (live.length === 0) {
        if (keptNotApplicable) continue;
        await db.insert(processChecklistItems).values({
          tenantId,
          processId,
          documentTypeId: item.type.id,
          label,
          requirement: item.requirement.requirement,
          status: "PENDENTE",
          sortOrder: item.requirement.sortOrder,
          conditionKey,
        });
        continue;
      }

      const [primary, ...extras] = live;
      await db
        .update(processChecklistItems)
        .set({
          label,
          requirement: item.requirement.requirement,
          sortOrder: item.requirement.sortOrder,
          conditionKey,
          updatedAt: new Date(),
        })
        .where(eq(processChecklistItems.id, primary.id));

      for (const extra of extras) {
        if (extra.status === "PENDENTE" && !extra.documentId) {
          await db
            .update(processChecklistItems)
            .set({
              status: "NAO_APLICAVEL",
              notes: RETIRED_NOTES,
              updatedAt: new Date(),
            })
            .where(eq(processChecklistItems.id, extra.id));
        }
      }
      continue;
    }

    const competences =
      qty === 3 ? months3 : qty === 2 ? months2 : lastNMonths(qty);

    for (const [index, competence] of competences.entries()) {
      const competenceLabel =
        expandLabel(item.requirement.labelTemplate, competence) ||
        `${item.type.name} — ${competence}`;
      const match = live.find((row) => row.competence === competence);
      if (match) {
        await db
          .update(processChecklistItems)
          .set({
            label: competenceLabel,
            requirement: item.requirement.requirement,
            sortOrder: item.requirement.sortOrder * 10 + index,
            conditionKey,
            updatedAt: new Date(),
          })
          .where(eq(processChecklistItems.id, match.id));
        continue;
      }
      await db.insert(processChecklistItems).values({
        tenantId,
        processId,
        documentTypeId: item.type.id,
        label: competenceLabel,
        requirement: item.requirement.requirement,
        status: "PENDENTE",
        sortOrder: item.requirement.sortOrder * 10 + index,
        competence,
        conditionKey,
      });
    }
  }

  for (const item of existing) {
    if (catalogTypeIds.has(item.documentTypeId)) continue;
    if (item.status !== "PENDENTE" || item.documentId) continue;
    await db
      .update(processChecklistItems)
      .set({
        status: "NAO_APLICAVEL",
        notes: RETIRED_NOTES,
        updatedAt: new Date(),
      })
      .where(eq(processChecklistItems.id, item.id));
  }

  return listChecklistRows(tenantId, processId);
}

async function listChecklistRows(tenantId: string, processId: string) {
  return db
    .select()
    .from(processChecklistItems)
    .where(
      and(
        eq(processChecklistItems.processId, processId),
        eq(processChecklistItems.tenantId, tenantId),
      ),
    )
    .orderBy(asc(processChecklistItems.sortOrder));
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

  await generateChecklistForProcess(
    session.tenantId,
    processId,
    process.incomeProfile as Profile,
    options,
  );

  return listChecklist(session, processId);
}

export async function listChecklist(session: SessionPayload, processId: string) {
  await loadProcessForSession(session, processId);

  const items = await db
    .select({
      item: processChecklistItems,
      documentTypeCode: documentTypes.code,
      documentTypeName: documentTypes.name,
      documentTypeDescription: documentTypes.description,
      allowsMultiple: documentTypes.allowsMultiple,
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

  const visible = items.filter(
    (row) =>
      !(
        row.item.status === "NAO_APLICAVEL" &&
        row.item.notes === RETIRED_NOTES
      ),
  );

  const itemIds = visible.map((row) => row.item.id);
  const files =
    itemIds.length === 0
      ? []
      : await db
          .select({
            id: documents.id,
            checklistItemId: documents.checklistItemId,
            originalFilename: documents.originalFilename,
            mimeType: documents.mimeType,
            status: documents.status,
            sizeBytes: documents.sizeBytes,
            documentDate: documents.documentDate,
            validUntil: documents.validUntil,
          })
          .from(documents)
          .where(
            and(
              eq(documents.processId, processId),
              eq(documents.tenantId, session.tenantId),
              inArray(documents.checklistItemId, itemIds),
            ),
          )
          .orderBy(asc(documents.createdAt));

  const filesByItem = new Map<string, typeof files>();
  for (const file of files) {
    if (!file.checklistItemId) continue;
    const list = filesByItem.get(file.checklistItemId) ?? [];
    list.push(file);
    filesByItem.set(file.checklistItemId, list);
  }

  const scored = visible.filter((i) => i.item.requirement !== "OPCIONAL");
  const totalApplicable = scored.filter(
    (i) => i.item.status !== "NAO_APLICAVEL",
  ).length;
  const completed = scored.filter(
    (i) =>
      i.item.status === "VALIDADO" ||
      i.item.status === "ENVIADO" ||
      i.item.status === "NAO_APLICAVEL",
  ).length;
  const validated = visible.filter((i) => i.item.status === "VALIDADO").length;
  const pending = visible.filter((i) => i.item.status === "PENDENTE").length;

  return {
    items: visible.map((row) => {
      const annex = getAnnexByCode(row.documentTypeCode);
      return {
        ...row.item,
        documentTypeCode: row.documentTypeCode,
        documentTypeName: row.documentTypeName,
        documentTypeDescription:
          annex?.description ?? row.documentTypeDescription,
        annexNumber: annex?.annexNumber ?? null,
        validityDays: annex?.validityDays ?? null,
        allowsMultiple: row.allowsMultiple,
        multipleHint: annexMultipleHint(annex),
        files: (filesByItem.get(row.item.id) ?? []).map((file) => ({
          id: file.id,
          originalFilename: file.originalFilename,
          mimeType: file.mimeType,
          status: file.status,
          sizeBytes: file.sizeBytes,
          documentDate: file.documentDate,
          validUntil: file.validUntil,
          expired:
            file.status === "EXPIRADO" ||
            (file.validUntil ? isExpiredOn(file.validUntil) : false),
        })),
      };
    }),
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
  await loadProcessForSession(session, processId);

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
