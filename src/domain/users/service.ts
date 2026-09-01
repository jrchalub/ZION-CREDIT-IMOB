import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { correspondents, users } from "@/db/schema";
import { writeAuditLog } from "@/domain/audit/service";
import { hashPassword } from "@/domain/auth/service";
import type { UserRole } from "@/domain/rbac/permissions";
import { AppError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth/session";

export const STAFF_ROLES = [
  "ADMIN",
  "GESTOR",
  "ANALISTA",
  "CORRESPONDENTE",
  "OPERADOR",
] as const satisfies readonly UserRole[];

export type StaffRole = (typeof STAFF_ROLES)[number];

export const createUserSchema = z
  .object({
    email: z.string().email("E-mail inválido"),
    password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
    fullName: z.string().min(3).max(200),
    role: z.enum(STAFF_ROLES),
    phone: z.string().max(30).optional().nullable(),
    correspondentId: z.string().uuid().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "CORRESPONDENTE" && !data.correspondentId) {
      ctx.addIssue({
        code: "custom",
        message: "Selecione a organização correspondente",
        path: ["correspondentId"],
      });
    }
  });

export const updateUserSchema = z.object({
  fullName: z.string().min(3).max(200).optional(),
  phone: z.string().max(30).optional().nullable(),
  role: z.enum(STAFF_ROLES).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
  correspondentId: z.string().uuid().optional().nullable(),
});

function sanitizeUser(row: typeof users.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    correspondentId: row.correspondentId,
    phone: row.phone,
    active: row.active,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listUsers(
  session: SessionPayload,
  opts: { page: number; pageSize: number; offset: number; q?: string },
) {
  const search = opts.q
    ? or(
        ilike(users.fullName, `%${opts.q}%`),
        ilike(users.email, `%${opts.q}%`),
      )
    : undefined;

  const where = and(eq(users.tenantId, session.tenantId), search);

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(opts.pageSize)
      .offset(opts.offset),
    db.select({ total: count() }).from(users).where(where),
  ]);

  return {
    items: rows.map(sanitizeUser),
    page: opts.page,
    pageSize: opts.pageSize,
    total: Number(totalRow[0]?.total ?? 0),
  };
}

export async function getUser(session: SessionPayload, id: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.tenantId, session.tenantId)))
    .limit(1);

  if (!row) throw new AppError(404, "Usuário não encontrado", "USER_NOT_FOUND");
  return sanitizeUser(row);
}

export async function getUserFormOptions(session: SessionPayload) {
  const correspondentRows = await db
    .select({
      id: correspondents.id,
      companyName: correspondents.companyName,
      active: correspondents.active,
    })
    .from(correspondents)
    .where(and(eq(correspondents.tenantId, session.tenantId), eq(correspondents.active, true)))
    .orderBy(correspondents.companyName);

  return {
    roles: STAFF_ROLES.map((role) => ({
      value: role,
      label: roleLabel(role),
    })),
    correspondents: correspondentRows,
  };
}

export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: "Administrador",
    GESTOR: "Gestor",
    ANALISTA: "Analista",
    CORRESPONDENTE: "Correspondente",
    OPERADOR: "Operador",
    CLIENTE: "Cliente",
  };
  return labels[role] ?? role;
}

async function assertCorrespondentInTenant(tenantId: string, correspondentId: string) {
  const [row] = await db
    .select({ id: correspondents.id })
    .from(correspondents)
    .where(
      and(
        eq(correspondents.id, correspondentId),
        eq(correspondents.tenantId, tenantId),
        eq(correspondents.active, true),
      ),
    )
    .limit(1);

  if (!row) {
    throw new AppError(
      400,
      "Organização correspondente inválida ou inativa",
      "CORRESPONDENT_INVALID",
    );
  }
}

export async function createUser(
  session: SessionPayload,
  input: z.infer<typeof createUserSchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const email = input.email.trim().toLowerCase();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, session.tenantId), eq(users.email, email)))
    .limit(1);

  if (existing) {
    throw new AppError(409, "Já existe usuário com este e-mail", "EMAIL_DUPLICATE");
  }

  let correspondentId: string | null = null;
  if (input.role === "CORRESPONDENTE") {
    await assertCorrespondentInTenant(session.tenantId, input.correspondentId!);
    correspondentId = input.correspondentId!;
  }

  const passwordHash = await hashPassword(input.password);

  const [created] = await db
    .insert(users)
    .values({
      tenantId: session.tenantId,
      email,
      passwordHash,
      fullName: input.fullName.trim(),
      role: input.role,
      phone: input.phone ?? null,
      correspondentId,
      active: true,
    })
    .returning();

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "CREATE",
    entity: "user",
    entityId: created.id,
    newValue: { email, role: input.role },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return sanitizeUser(created);
}

export async function updateUser(
  session: SessionPayload,
  id: string,
  input: z.infer<typeof updateUserSchema>,
  meta?: { ip?: string | null; userAgent?: string | null; correlationId?: string },
) {
  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.tenantId, session.tenantId)))
    .limit(1);

  if (!existing) throw new AppError(404, "Usuário não encontrado", "USER_NOT_FOUND");

  if (input.active === false && id === session.sub) {
    throw new AppError(400, "Você não pode desativar sua própria conta", "SELF_DEACTIVATE");
  }

  const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };

  if (input.fullName !== undefined) patch.fullName = input.fullName.trim();
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.active !== undefined) patch.active = input.active;
  if (input.password) patch.passwordHash = await hashPassword(input.password);

  const nextRole = input.role ?? existing.role;
  if (input.role !== undefined) patch.role = input.role;

  if (nextRole === "CORRESPONDENTE") {
    const correspondentId = input.correspondentId ?? existing.correspondentId;
    if (!correspondentId) {
      throw new AppError(
        400,
        "Correspondente exige vínculo com organização",
        "CORRESPONDENT_REQUIRED",
      );
    }
    await assertCorrespondentInTenant(session.tenantId, correspondentId);
    patch.correspondentId = correspondentId;
  } else if (input.role !== undefined || input.correspondentId !== undefined) {
    patch.correspondentId = null;
  }

  const [updated] = await db
    .update(users)
    .set(patch)
    .where(and(eq(users.id, id), eq(users.tenantId, session.tenantId)))
    .returning();

  await writeAuditLog({
    tenantId: session.tenantId,
    userId: session.sub,
    action: "UPDATE",
    entity: "user",
    entityId: id,
    newValue: {
      role: patch.role,
      active: patch.active,
      passwordChanged: Boolean(input.password),
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
    correlationId: meta?.correlationId,
  });

  return sanitizeUser(updated);
}
