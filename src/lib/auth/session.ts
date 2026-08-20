import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { UserRole } from "@/domain/rbac/permissions";
import { AppError } from "@/lib/api";

export type SessionPayload = {
  sub: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: UserRole;
  /** Set for CORRESPONDENTE users linked to an org. */
  correspondentId: string | null;
};

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "zion_session";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

function ttlHours() {
  return Number(process.env.AUTH_TOKEN_TTL_HOURS ?? "12") || 12;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    tenantId: payload.tenantId,
    email: payload.email,
    fullName: payload.fullName,
    role: payload.role,
    correspondentId: payload.correspondentId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlHours()}h`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  if (
    typeof payload.sub !== "string" ||
    typeof payload.tenantId !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.fullName !== "string" ||
    typeof payload.role !== "string"
  ) {
    throw new AppError(401, "Sessão inválida", "INVALID_SESSION");
  }

  const correspondentId =
    typeof payload.correspondentId === "string" ? payload.correspondentId : null;

  return {
    sub: payload.sub,
    tenantId: payload.tenantId,
    email: payload.email,
    fullName: payload.fullName,
    role: payload.role as UserRole,
    correspondentId,
  };
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ttlHours() * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AppError(401, "Não autenticado", "UNAUTHENTICATED");
  }
  return session;
}

export { COOKIE_NAME };
