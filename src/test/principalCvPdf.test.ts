import { describe, it, expect } from "vitest";
import { missingForPrincipal, seaColumns, fmtDate } from "@/lib/principalCvPdf";

describe("principal CV presets", () => {
  it("Anglo style includes engine and sign-off reason columns", () => {
    const keys = seaColumns("anglo").map(c => c.key);
    expect(keys).toContain("engine");
    expect(keys).toContain("reason");
  });
  it("Synergy style includes vetting column", () => {
    expect(seaColumns("synergy").map(c => c.key)).toContain("vetting");
  });
  it("flags missing passport and photo", () => {
    const m = missingForPrincipal({ personal: { firstName: "A", dob: "1990-01-01", cdcNo: "X" }, sea: [{ vesselName: "V" }], certs: [{ number: "1" }], edu: [], skills: {} });
    expect(m).toEqual(["Passport no.", "Photo"]);
  });
  it("formats dates day-month-year", () => { expect(fmtDate("2026-10-24")).toBe("24-10-2026"); });
});
