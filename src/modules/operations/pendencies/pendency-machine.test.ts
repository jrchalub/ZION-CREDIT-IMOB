import { describe, expect, it } from "vitest";
import {
  assertPendencyTransition,
  isOpenPendencyStatus,
  OPEN_PENDENCY_STATUSES,
} from "./pendency-machine";

describe("pendency self-service machine", () => {
  it("allows analyst create flow OPEN → SUBMITTED → UNDER_REVIEW → RESOLVED", () => {
    expect(() => assertPendencyTransition("OPEN", "SUBMITTED")).not.toThrow();
    expect(() =>
      assertPendencyTransition("SUBMITTED", "UNDER_REVIEW"),
    ).not.toThrow();
    expect(() =>
      assertPendencyTransition("UNDER_REVIEW", "RESOLVED"),
    ).not.toThrow();
  });

  it("allows reject and resubmit", () => {
    expect(() =>
      assertPendencyTransition("UNDER_REVIEW", "REJECTED"),
    ).not.toThrow();
    expect(() => assertPendencyTransition("REJECTED", "SUBMITTED")).not.toThrow();
  });

  it("blocks illegal jumps", () => {
    expect(() => assertPendencyTransition("RESOLVED", "OPEN")).toThrow();
    expect(() => assertPendencyTransition("CANCELLED", "SUBMITTED")).toThrow();
    expect(() => assertPendencyTransition("OPEN", "REJECTED")).toThrow();
  });

  it("treats OPEN/SUBMITTED/UNDER_REVIEW/REJECTED as open queue", () => {
    for (const s of OPEN_PENDENCY_STATUSES) {
      expect(isOpenPendencyStatus(s)).toBe(true);
    }
    expect(isOpenPendencyStatus("RESOLVED")).toBe(false);
    expect(isOpenPendencyStatus("CANCELLED")).toBe(false);
  });
});
