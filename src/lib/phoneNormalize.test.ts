import { describe, it, expect } from "vitest";
import { normalizePhone, extractLeadsFromText } from "./phoneNormalize";

describe("normalizePhone", () => {
  it("local Indonesian 08 → +628", () => expect(normalizePhone("0812-3456-7890")).toBe("+6281234567890"));
  it("fixes +62 0 typo", () => expect(normalizePhone("+62 0812 3456 7890")).toBe("+6281234567890"));
  it("keeps spaced international", () => expect(normalizePhone("+62 852 1987 8989")).toBe("+6285219878989"));
  it("adds 62 to bare 8…", () => expect(normalizePhone("81234567890")).toBe("+6281234567890"));
  it("keeps Philippines number", () => expect(normalizePhone("+63 917 123 4567")).toBe("+639171234567"));
  it("rejects too short", () => expect(normalizePhone("12345")).toBeNull());
});

describe("extractLeadsFromText", () => {
  it("extracts number only, never a name", () => {
    const r = extractLeadsFromText("Budi Santoso - Oiler 0812 3456 7890");
    expect(r[0].phone_e164).toBe("+6281234567890");
    expect(r[0].name).toBeNull();
  });
});
