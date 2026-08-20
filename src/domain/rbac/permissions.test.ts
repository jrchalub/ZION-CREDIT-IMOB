import { describe, expect, it } from "vitest";
import { hasPermission, navItemsForRole } from "./permissions";

describe("rbac", () => {
  it("grants admin full access", () => {
    expect(hasPermission("ADMIN", "settings:write")).toBe(true);
    expect(hasPermission("ADMIN", "audit:read")).toBe(true);
    expect(hasPermission("ADMIN", "financial:write")).toBe(true);
    expect(hasPermission("ADMIN", "decision:write")).toBe(true);
  });

  it("restricts cliente role", () => {
    expect(hasPermission("CLIENTE", "processes:read")).toBe(true);
    expect(hasPermission("CLIENTE", "processes:write")).toBe(false);
    expect(hasPermission("CLIENTE", "audit:read")).toBe(false);
  });

  it("allows correspondente operational access without credit writes", () => {
    expect(hasPermission("CORRESPONDENTE", "clients:write")).toBe(true);
    expect(hasPermission("CORRESPONDENTE", "processes:write")).toBe(true);
    expect(hasPermission("CORRESPONDENTE", "documents:write")).toBe(true);
    expect(hasPermission("CORRESPONDENTE", "pendencies:respond")).toBe(true);
    expect(hasPermission("CORRESPONDENTE", "processes:transition")).toBe(false);
    expect(hasPermission("CORRESPONDENTE", "financial:read")).toBe(false);
    expect(hasPermission("CORRESPONDENTE", "financial:write")).toBe(false);
    expect(hasPermission("CORRESPONDENTE", "decision:read")).toBe(false);
    expect(hasPermission("CORRESPONDENTE", "decision:write")).toBe(false);
    expect(hasPermission("CORRESPONDENTE", "operations:read")).toBe(false);
    expect(hasPermission("CORRESPONDENTE", "integrations:write")).toBe(false);
    expect(hasPermission("CORRESPONDENTE", "audit:read")).toBe(false);
  });

  it("hides auditoria from correspondent nav", () => {
    const hrefs = navItemsForRole("CORRESPONDENTE").map((i) => i.href);
    expect(hrefs).toContain("/processes");
    expect(hrefs).not.toContain("/audit");
  });
});
