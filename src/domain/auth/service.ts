import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { UserRole } from "@/domain/rbac/permissions";
import { assertPermission, type Permission } from "@/domain/rbac/permissions";
import { AppError } from "@/lib/api";
import {
  clearSessionCookie,
  createSessionToken,
  requireSession,
  setSessionCookie,
  type SessionPayload,
} from "@/lib/auth/session";
import { writeAuditLog } from "@/domain/audit/service";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function login(input: {
  email: string;
  password: string;
  tenantSlug?: string;
  ip?: string | null;
  userAgent?: string | null;
  correlationId?: string;
}): Promise<SessionPayload> {
  const email = input.email.trim().toLowerCase();

  const rows = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      passwordHash: users.passwordHash,
      active: users.active,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(5);

  const user = rows.find((row) => row.active);
  if (!user) {
    throw new AppError(401, "Credenciais inválidas", "INVALID_CREDENTIALS");
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw new AppError(401, "Credenciais inválidas", "INVALID_CREDENTIALS");
  }

  const session: SessionPayload = {
    sub: user.id,
    tenantId: user.tenantId,
    email: user.email,
    fullName: user.fullName,
    role: user.role as UserRole,
  };

  const token = await createSessionToken(session);
  await setSessionCookie(token);

  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(and(eq(users.id, user.id), eq(users.tenantId, user.tenantId)));

  await writeAuditLog({
    tenantId: user.tenantId,
    userId: user.id,
    action: "LOGIN",
    entity: "user",
    entityId: user.id,
    ip: input.ip,
    userAgent: input.userAgent,
    correlationId: input.correlationId,
  });

  return session;
}

export async function logout(opts?: {
  ip?: string | null;
  userAgent?: string | null;
  correlationId?: string;
}) {
  const session = await requireSession().catch(() => null);
  await clearSessionCookie();
  if (session) {
    await writeAuditLog({
      tenantId: session.tenantId,
      userId: session.sub,
      action: "LOGOUT",
      entity: "user",
      entityId: session.sub,
      ip: opts?.ip,
      userAgent: opts?.userAgent,
      correlationId: opts?.correlationId,
    });
  }
}

export async function requirePermission(permission: Permission): Promise<SessionPayload> {
  const session = await requireSession();
  try {
    assertPermission(session.role, permission);
  } catch {
    throw new AppError(403, "Acesso negado", "FORBIDDEN");
  }
  return session;
}
