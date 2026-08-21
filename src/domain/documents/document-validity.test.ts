import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  computeValidityWindow,
  extractDocumentDateFromFields,
  isExpiredOn,
  parseCalendarDate,
} from "./document-validity";

describe("document validity (Anexo 5)", () => {
  it("parses ISO and BR calendar dates", () => {
    expect(parseCalendarDate("2026-08-01")).toBe("2026-08-01");
    expect(parseCalendarDate("01/08/2026")).toBe("2026-08-01");
    expect(parseCalendarDate("31/02/2026")).toBeNull();
  });

  it("adds 60 calendar days inclusively", () => {
    expect(addCalendarDays("2026-08-20", 60)).toBe("2026-10-19");
  });

  it("is valid on the last day and expired the day after", () => {
    const window = computeValidityWindow({
      documentDate: "2026-08-01",
      validityDays: 60,
      asOf: new Date(2026, 7, 20),
    });
    expect(window.validUntil).toBe("2026-09-30");
    expect(window.expired).toBe(false);
    expect(isExpiredOn(window.validUntil, new Date(2026, 8, 30))).toBe(false);
    expect(isExpiredOn(window.validUntil, new Date(2026, 9, 1))).toBe(true);
  });

  it("rejects a future document date", () => {
    expect(() =>
      computeValidityWindow({
        documentDate: "2026-12-01",
        validityDays: 60,
        asOf: new Date(2026, 7, 20),
      }),
    ).toThrow(/não pode ser futura/);
  });

  it("reads extracted issue dates including competence month", () => {
    expect(
      extractDocumentDateFromFields([
        { field: "competence", value: "2026-07" },
      ]),
    ).toBe("2026-07-31");
    expect(
      extractDocumentDateFromFields([
        { field: "document_date", value: "15/07/2026" },
      ]),
    ).toBe("2026-07-15");
  });
});
