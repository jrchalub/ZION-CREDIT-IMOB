export type UserRole =
  | "ADMIN"
  | "GESTOR"
  | "ANALISTA"
  | "CORRESPONDENTE"
  | "OPERADOR"
  | "CLIENTE";

export type Permission =
  | "dashboard:read"
  | "clients:read"
  | "clients:write"
  | "processes:read"
  | "processes:write"
  | "processes:transition"
  | "documents:read"
  | "documents:write"
  | "documents:review"
  | "pendencies:read"
  | "pendencies:write"
  | "audit:read"
  | "users:read"
  | "users:write"
  | "settings:write";

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  ADMIN: [
    "dashboard:read",
    "clients:read",
    "clients:write",
    "processes:read",
    "processes:write",
    "processes:transition",
    "documents:read",
    "documents:write",
    "documents:review",
    "pendencies:read",
    "pendencies:write",
    "audit:read",
    "users:read",
    "users:write",
    "settings:write",
  ],
  GESTOR: [
    "dashboard:read",
    "clients:read",
    "clients:write",
    "processes:read",
    "processes:write",
    "processes:transition",
    "documents:read",
    "documents:write",
    "documents:review",
    "pendencies:read",
    "pendencies:write",
    "audit:read",
    "users:read",
  ],
  ANALISTA: [
    "dashboard:read",
    "clients:read",
    "processes:read",
    "processes:write",
    "processes:transition",
    "documents:read",
    "documents:write",
    "documents:review",
    "pendencies:read",
    "pendencies:write",
    "audit:read",
  ],
  CORRESPONDENTE: [
    "dashboard:read",
    "clients:read",
    "clients:write",
    "processes:read",
    "processes:write",
    "documents:read",
    "documents:write",
    "pendencies:read",
  ],
  OPERADOR: [
    "dashboard:read",
    "clients:read",
    "clients:write",
    "processes:read",
    "processes:write",
    "documents:read",
    "documents:write",
    "pendencies:read",
    "pendencies:write",
  ],
  CLIENTE: [
    "processes:read",
    "clients:read",
    "documents:read",
    "documents:write",
    "pendencies:read",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertPermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Permissão negada: ${permission}`);
  }
}

export function listPermissions(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}
