import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions";

describe("rbac", () => {
  it("grants admin full access", () => {
    expect(hasPermission("ADMIN", "settings:write")).toBe(true);
    expect(hasPermission("ADMIN", "audit:read")).toBe(true);
  });

  it("restricts cliente role", () => {
    expect(hasPermission("CLIENTE", "processes:read")).toBe(true);
    expect(hasPermission("CLIENTE", "processes:write")).toBe(false);
    expect(hasPermission("CLIENTE", "audit:read")).toBe(false);
  });

  it("allows correspondente to manage own operational data", () => {
    expect(hasPermission("CORRESPONDENTE", "clients:write")).toBe(true);
    expect(hasPermission("CORRESPONDENTE", "processes:transition")).toBe(false);
  });
});
