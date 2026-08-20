export type UserRole =
  | "ADMIN"
  | "GESTOR"
  | "ANALISTA"
  | "CORRESPONDENTE"
  | "OPERADOR"
  | "CLIENTE";

export type Permission =
  | "dashboard:read"
  | "operations:read"
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
  | "pendencies:respond"
  | "financial:read"
  | "financial:write"
  | "decision:read"
  | "decision:write"
  | "integrations:read"
  | "integrations:write"
  | "audit:read"
  | "users:read"
  | "users:write"
  | "settings:write";

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  ADMIN: [
    "dashboard:read",
    "operations:read",
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
    "pendencies:respond",
    "financial:read",
    "financial:write",
    "decision:read",
    "decision:write",
    "integrations:read",
    "integrations:write",
    "audit:read",
    "users:read",
    "users:write",
    "settings:write",
  ],
  GESTOR: [
    "dashboard:read",
    "operations:read",
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
    "pendencies:respond",
    "financial:read",
    "financial:write",
    "decision:read",
    "decision:write",
    "integrations:read",
    "integrations:write",
    "audit:read",
    "users:read",
  ],
  ANALISTA: [
    "dashboard:read",
    "operations:read",
    "clients:read",
    "processes:read",
    "processes:write",
    "processes:transition",
    "documents:read",
    "documents:write",
    "documents:review",
    "pendencies:read",
    "pendencies:write",
    "pendencies:respond",
    "financial:read",
    "financial:write",
    "decision:read",
    "decision:write",
    "integrations:read",
    "integrations:write",
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
    "pendencies:respond",
  ],
  OPERADOR: [
    "dashboard:read",
    "operations:read",
    "clients:read",
    "clients:write",
    "processes:read",
    "processes:write",
    "documents:read",
    "documents:write",
    "pendencies:read",
    "pendencies:write",
    "pendencies:respond",
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

/** Nav items allowed for a role (FASE 6.2 correspondent shell). */
export function navItemsForRole(role: UserRole): Array<{
  href: string;
  label: string;
  permission?: Permission;
}> {
  const all = [
    { href: "/dashboard", label: "Dashboard", permission: "dashboard:read" as const },
    { href: "/clients", label: "Clientes", permission: "clients:read" as const },
    {
      href: "/processes",
      label: role === "CORRESPONDENTE" ? "Meus processos" : "Processos",
      permission: "processes:read" as const,
    },
    { href: "/audit", label: "Auditoria", permission: "audit:read" as const },
  ];
  return all.filter((item) => !item.permission || hasPermission(role, item.permission));
}
