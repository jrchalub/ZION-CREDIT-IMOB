import { describe, expect, it } from "vitest";
import { deriveChecklistStatusFromDocuments } from "./checklist-status";

describe("deriveChecklistStatusFromDocuments", () => {
  it("is pending when there are no files", () => {
    expect(deriveChecklistStatusFromDocuments([])).toBe("PENDENTE");
  });

  it("is sent when any active file is still under review", () => {
    expect(
      deriveChecklistStatusFromDocuments(["RECEBIDO", "VALIDADO"]),
    ).toBe("ENVIADO");
  });

  it("is validated only when every active file is validated", () => {
    expect(
      deriveChecklistStatusFromDocuments(["VALIDADO", "VALIDADO"]),
    ).toBe("VALIDADO");
  });

  it("ignores rejected files if another file remains active", () => {
    expect(
      deriveChecklistStatusFromDocuments(["REJEITADO", "RECEBIDO"]),
    ).toBe("ENVIADO");
  });

  it("is rejected when every file was rejected", () => {
    expect(
      deriveChecklistStatusFromDocuments(["REJEITADO", "REJEITADO"]),
    ).toBe("REJEITADO");
  });
});
