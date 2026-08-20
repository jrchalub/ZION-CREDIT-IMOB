import { describe, expect, it } from "vitest";
import {
  buildStorageKey,
  getExtension,
  sanitizeFilename,
  sha256,
} from "./upload-validation";

describe("upload validation helpers", () => {
  it("hashes content stably", () => {
    expect(sha256(Buffer.from("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("sanitizes filename and blocks path parts via basename", () => {
    expect(sanitizeFilename("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(getExtension("extrato.PDF")).toBe("pdf");
  });

  it("builds tenant-scoped private storage keys", () => {
    const key = buildStorageKey({
      tenantId: "t1",
      processId: "p1",
      documentId: "d1",
      extension: "pdf",
    });
    expect(key).toBe("tenants/t1/processes/p1/documents/d1.pdf");
    expect(key.includes("public")).toBe(false);
  });
});
