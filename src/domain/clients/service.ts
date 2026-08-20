import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clientAddresses, clients } from "@/db/schema";
import { writeAuditLog } from "@/domain/audit/service";
import { AppError } from "@/lib/api";
import { isValidCpf, stripCpf } from "@/lib/cpf";
import type { SessionPayload } from "@/lib/auth/session";

export const createClientSchema = z.object({
  fullName: z.string().min(3).max(200),
  cpf: z
    .string()
    .refine((v) => isValidCpf(v), "CPF inválido"),
  rg: z.string().max(30).optional().nullable(),
  birthDate: z.string().optional().nullable(),
  maritalStatus: z
    .enum(["SOLTEIRO", "CASADO", "DIVORCIADO", "VIUVO", "UNIAO_ESTAVEL", "SEPARADO"])
    .optional()
    .nullable(),
  nationality: z.string().max(80).optional().nullable(),
  profession: z.string().max(120).optional().nullable(),
  occupationType: z.string().max(80).optional().nullable(),
  activityStartDate: z.string().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  email: z
    .string()
    .email()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  declaredIncome: z.string().optional().nullable(),
  fgtsBalance: z.string().optional().nullable(),
  downPaymentAvailable: z.string().optional().nullable(),
  primaryBank: z.string().max(80).optional().nullable(),
  bankAccount: z.string().max(80).optional().nullable(),
  overdraftLimit: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  address: z
    .object({
      street: z.string().min(1),
      number: z.string().optional().nullable(),
      complement: z.string().optional().nullable(),
      neighborhood: z.string().optional().nullable(),
      city: z.string().min(1),
      state: z.string().length(2),
      zipCode: z.string().min(8).max(9),
    })
    .optional(),
});

export const updateClientSchema = createClientSchema.partial();

export async function listClients(
  session: SessionPayload,
  opts: { page: number; pageSize: number; offset: number; q?: string },
) {
  const where = opts.q
    ? and(
        eq(clients.tenantId, session.tenantId),
        or(
          ilike(clients.fullName, `%${opts.q}%`),
          ilike(clients.email, `%${opts.q}%`),
          eq(clients.cpf, stripCpf(opts.q)),
        ),
      )
    : eq(clients.tenantId, session.tenantId);

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(clients)
      .where(where)
      .orderBy(desc(clients.createdAt))
      .limit(opts.pageSize)
      .offset(opts.offset),
    db.select({ value: count() }).from(clients).where(where),
  ]);

  return {
    items: rows,
    page: opts.page,
    pageSize: opts.pageSize,
    total: Number(totalRow[0]?.value ?? 0),
  };
}

export async function getClient(session: SessionPayload, id: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.tenantId, session.tenantId)))
    .limit(1);

  if (!client) throw new AppError(404, "Cliente não encontrado", "CLIENT_NOT_FOUND");

  const addresses = await db
    .select()
    .from(clientAddresses)
    .where(
      and(
        eq(clientAddresses.clientId, id),
        eq(clientAddresses.tenantId, session.tenantId),
      ),
    );

  return { ...client, addresses };
}

export async function createClient(
  session: SessionPayload,
  input: z.infer<typeof createClientSchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const cpf = stripCpf(input.cpf);

  const [existing] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.tenantId, session.tenantId), eq(clients.cpf, cpf)))
    .limit(1);

  if (existing) {
    throw new AppError(409, "Já existe cliente com este CPF neste tenant", "CPF_DUPLICATE");
  }

  const [created] = await db
    .insert(clients)
    .values({
      tenantId: session.tenantId,
      fullName: input.fullName.trim(),
      cpf,
      rg: input.rg ?? null,
      birthDate: input.birthDate ?? null,
      maritalStatus: input.maritalStatus ?? null,
      nationality: input.nationality ?? "Brasileira",
      profession: input.profession ?? null,
      occupationType: input.occupationType ?? null,
      activityStartDate: input.activityStartDate ?? null,
      phone: input.phone ?? null,
      whatsapp: input.whatsapp ?? null,
      email: input.email ?? null,
      declaredIncome: input.declaredIncome ?? null,
      fgtsBalance: input.fgtsBalance ?? null,
      downPaymentAvailable: input.downPaymentAvailable ?? null,
      primaryBank: input.primaryBank ?? null,
      bankAccount: input.bankAccount ?? null,
      overdraftLimit: input.overdraftLimit ?? null,
      notes: input.notes ?? null,
      createdByUserId: session.sub,
    })
    .returning();

  if (input.address) {
    await db.insert(clientAddresses).values({
      tenantId: session.tenantId,
      clientId: created.id,
      street: input.address.street,
      number: input.address.number ?? null,
      complement: input.address.complement ?? null,
      neighborhood: input.address.neighborhood ?? null,
      city: input.address.city,
      state: input.address.state.toUpperCase(),
      zipCode: input.address.zipCode.replace(/\D/g, ""),
      isPrimary: true,
    });
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "CREATE",
    entity: "client",
    entityId: created.id,
    newValue: { fullName: created.fullName, cpf },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return getClient(session, created.id);
}

export async function updateClient(
  session: SessionPayload,
  id: string,
  input: z.infer<typeof updateClientSchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const current = await getClient(session, id);

  const cpf = input.cpf ? stripCpf(input.cpf) : undefined;
  if (cpf && cpf !== current.cpf) {
    const [dup] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.tenantId, session.tenantId), eq(clients.cpf, cpf)))
      .limit(1);
    if (dup) {
      throw new AppError(409, "Já existe cliente com este CPF neste tenant", "CPF_DUPLICATE");
    }
  }

  const [updated] = await db
    .update(clients)
    .set({
      ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
      ...(cpf !== undefined ? { cpf } : {}),
      ...(input.rg !== undefined ? { rg: input.rg } : {}),
      ...(input.birthDate !== undefined ? { birthDate: input.birthDate } : {}),
      ...(input.maritalStatus !== undefined ? { maritalStatus: input.maritalStatus } : {}),
      ...(input.nationality !== undefined ? { nationality: input.nationality } : {}),
      ...(input.profession !== undefined ? { profession: input.profession } : {}),
      ...(input.occupationType !== undefined ? { occupationType: input.occupationType } : {}),
      ...(input.activityStartDate !== undefined
        ? { activityStartDate: input.activityStartDate }
        : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.declaredIncome !== undefined ? { declaredIncome: input.declaredIncome } : {}),
      ...(input.fgtsBalance !== undefined ? { fgtsBalance: input.fgtsBalance } : {}),
      ...(input.downPaymentAvailable !== undefined
        ? { downPaymentAvailable: input.downPaymentAvailable }
        : {}),
      ...(input.primaryBank !== undefined ? { primaryBank: input.primaryBank } : {}),
      ...(input.bankAccount !== undefined ? { bankAccount: input.bankAccount } : {}),
      ...(input.overdraftLimit !== undefined ? { overdraftLimit: input.overdraftLimit } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(clients.id, id), eq(clients.tenantId, session.tenantId)))
    .returning();

  if (!updated) throw new AppError(404, "Cliente não encontrado", "CLIENT_NOT_FOUND");

  if (input.address) {
    const primary = current.addresses.find((a) => a.isPrimary) ?? current.addresses[0];
    if (primary) {
      await db
        .update(clientAddresses)
        .set({
          street: input.address.street,
          number: input.address.number ?? null,
          complement: input.address.complement ?? null,
          neighborhood: input.address.neighborhood ?? null,
          city: input.address.city,
          state: input.address.state.toUpperCase(),
          zipCode: input.address.zipCode.replace(/\D/g, ""),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(clientAddresses.id, primary.id),
            eq(clientAddresses.tenantId, session.tenantId),
          ),
        );
    } else {
      await db.insert(clientAddresses).values({
        tenantId: session.tenantId,
        clientId: id,
        street: input.address.street,
        number: input.address.number ?? null,
        complement: input.address.complement ?? null,
        neighborhood: input.address.neighborhood ?? null,
        city: input.address.city,
        state: input.address.state.toUpperCase(),
        zipCode: input.address.zipCode.replace(/\D/g, ""),
        isPrimary: true,
      });
    }
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "UPDATE",
    entity: "client",
    entityId: id,
    oldValue: { fullName: current.fullName, cpf: current.cpf },
    newValue: { fullName: updated.fullName, cpf: updated.cpf },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return getClient(session, id);
}

export async function countClientsByTenant(tenantId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(clients)
    .where(eq(clients.tenantId, tenantId));
  return Number(row?.value ?? 0);
}
