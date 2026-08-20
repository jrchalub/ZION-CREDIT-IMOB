import { describe, expect, it } from "vitest";
import { decideClassification } from "./ConfidencePolicy";

describe("confidence policy", () => {
  it("auto-suggests high confidence", () => {
    expect(decideClassification(0.95)).toBe("AUTO_SUGGESTED");
  });

  it("requires review for mid confidence", () => {
    expect(decideClassification(0.8)).toBe("REQUIRES_REVIEW");
  });

  it("flags low confidence", () => {
    expect(decideClassification(0.5)).toBe("LOW_CONFIDENCE");
  });
});
