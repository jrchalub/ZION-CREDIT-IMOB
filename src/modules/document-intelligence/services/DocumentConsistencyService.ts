import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, documentExtractedFields, documents } from "@/db/schema";
import { stripCpf } from "@/lib/cpf";

export type ConsistencyIssue = {
  type: string;
  message: string;
  confidence?: number;
};

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function fieldMap(
  rows: Array<{ field: string; value: string | null; confidence: string | null }>,
) {
  const map = new Map<string, { value: string; confidence: number }>();
  for (const row of rows) {
    if (!row.value) continue;
    map.set(row.field, {
      value: row.value,
      confidence: Number(row.confidence ?? 0),
    });
  }
  return map;
}

/**
 * Cross-document consistency vs client cadastro.
 * Produces explainable score — never used as credit approval.
 */
export async function runDocumentConsistency(input: {
  tenantId: string;
  processId: string;
  documentId: string;
}) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, input.documentId),
        eq(documents.tenantId, input.tenantId),
      ),
    )
    .limit(1);

  if (!doc) {
    return { consistencyScore: 0, issues: [], factors: [] };
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, doc.clientId), eq(clients.tenantId, input.tenantId)))
    .limit(1);

  const extracted = await db
    .select({
      field: documentExtractedFields.field,
      value: documentExtractedFields.value,
      confidence: documentExtractedFields.confidence,
    })
    .from(documentExtractedFields)
    .where(
      and(
        eq(documentExtractedFields.documentId, input.documentId),
        eq(documentExtractedFields.tenantId, input.tenantId),
      ),
    );

  const fields = fieldMap(extracted);
  const issues: ConsistencyIssue[] = [];
  const factors: Array<{ label: string; positive: boolean }> = [];

  const extractedName = fields.get("full_name");
  if (client && extractedName) {
    const same =
      normalizeName(extractedName.value) === normalizeName(client.fullName);
    if (same) {
      factors.push({ label: "Nome consistente", positive: true });
    } else {
      issues.push({
        type: "NAME_MISMATCH",
        message: "Nome divergente entre cadastro e documento",
        confidence: extractedName.confidence,
      });
      factors.push({ label: "Nome divergente", positive: false });
    }
  }

  const extractedCpf = fields.get("cpf");
  if (client && extractedCpf) {
    const same = stripCpf(extractedCpf.value) === stripCpf(client.cpf);
    if (same) {
      factors.push({ label: "CPF consistente", positive: true });
    } else {
      issues.push({
        type: "CPF_MISMATCH",
        message: "CPF divergente entre cadastro e documento",
        confidence: extractedCpf.confidence,
      });
      factors.push({ label: "CPF divergente", positive: false });
    }
  }

  for (const [field, meta] of fields) {
    if (meta.confidence < 0.7) {
      issues.push({
        type: "LOW_CONFIDENCE",
        message: `Campo ${field} com baixa confiança (${meta.confidence})`,
        confidence: meta.confidence,
      });
    }
  }

  const positives = factors.filter((f) => f.positive).length;
  const negatives = factors.filter((f) => !f.positive).length + issues.length;
  const consistencyScore = Math.max(
    0,
    Math.min(100, 100 - negatives * 18 + positives * 2),
  );

  return { consistencyScore, issues, factors };
}
