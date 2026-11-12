import { describe, it, expect } from "vitest";
import { mapRows, parseCsv, toIsoDate, normalisePhone, dedupeRows, templateCsv, inviteMessage } from "@/lib/companyCrewImport";

describe("company crew import", () => {
  it("parses dates in office formats", () => {
    expect(toIsoDate("15/04/1985")).toBe("1985-04-15");
    expect(toIsoDate("2026-12-01")).toBe("2026-12-01");
    expect(toIsoDate("12 Mar 2027")).toBe("2027-03-12");
    expect(toIsoDate("31/02/2026")).toBeUndefined();
  });
  it("normalises phones with 00 prefix", () => {
    expect(normalisePhone("0063 917 123 4567")).toBe("+639171234567");
    expect(normalisePhone("123")).toBeUndefined();
  });
  it("requires name and rank per row", () => {
    const t = parseCsv("Full Name,Rank,Email\nJuan Dela Cruz,Chief Officer,JUAN@x.com\n,Master,a@b.com\nNo Rank,,c@d.com\n");
    const r = mapRows(t);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ first_name: "Juan Dela", last_name: "Cruz", rank: "Chief Officer", email: "juan@x.com" });
    expect(r.problems.map(p => p.reason)).toEqual(["Missing name", "Missing rank"]);
  });
  it("turns CoC and medical expiry columns into certificates", () => {
    const r = mapRows(parseCsv("Name,Rank,CoC Number,CoC Expiry,Medical Expiry\nA B,Master,C-1,30/06/2028,15/03/2027"));
    expect(r.rows[0].certificates).toEqual([
      { name: "Certificate of Competency (CoC)", number: "C-1", expiry_date: "2028-06-30" },
      { name: "Medical Fitness Certificate", expiry_date: "2027-03-15" },
    ]);
  });
  it("drops duplicate email or phone inside one file", () => {
    const r = dedupeRows([{ first_name: "A", last_name: "", rank: "AB", email: "a@x.com" }, { first_name: "B", last_name: "", rank: "AB", email: "a@x.com" }]);
    expect(r.rows).toHaveLength(1); expect(r.duplicates).toBe(1);
  });
  it("template header row maps cleanly", () => {
    const r = mapRows(parseCsv(templateCsv()));
    expect(r.rows).toHaveLength(1); expect(r.rows[0].whatsapp).toBe("+639171234567");
  });
  it("invite message carries crew ID and claim link", () => {
    const m = inviteMessage({ first_name: "Juan", rank: "Master", crew_unique_id: "SM-2026-00010", claim_token: "abc" }, "Ocean Co");
    expect(m).toContain("SM-2026-00010"); expect(m).toContain("https://seaminds.life/claim/abc");
  });
});
