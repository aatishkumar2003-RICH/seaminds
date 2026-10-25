import { describe, it, expect } from "vitest";
import { classify, expiresMidContract, buildRadar } from "./certRadar";
import { daysServed } from "./portageBill";

const T = "2026-10-25";
describe("certificate radar", () => {
  it("expired before today", () => expect(classify("2026-10-24", T).status).toBe("expired"));
  it("critical within 30 days", () => expect(classify("2026-11-24", T).status).toBe("critical"));
  it("warning between 31 and 90 days", () => expect(classify("2027-01-10", T).status).toBe("warning"));
  it("valid beyond 90 days", () => expect(classify("2027-06-01", T).status).toBe("valid"));
  it("missing date is no_expiry", () => expect(classify("", T).status).toBe("no_expiry"));
  it("flags expiry before contract end", () => {
    expect(expiresMidContract("2027-01-01", "2026-09-01", 6, T)).toBe(true);
    expect(expiresMidContract("2027-06-01", "2026-09-01", 6, T)).toBe(false);
  });
  it("sorts expired first", () => {
    const rows = buildRadar([{ application_id: "a", crew_name: "A", rank: "AB", vessel: "X", contract_start: null, contract_months: null,
      certs: [{ name: "Medical", number: "", expiry: "2027-06-01" }, { name: "CoC", number: "", expiry: "2026-01-01" }] }], T);
    expect(rows[0].name).toBe("CoC");
  });
});

describe("sign-off settlement", () => {
  it("counts days up to and including the sign-off day", () => expect(daysServed("2026-10", "2026-06-01", 9, "2026-10-15")).toBe(15));
});
