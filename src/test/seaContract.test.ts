import { describe, it, expect } from "vitest";
import { suggestedLeavePay, monthlyTotal, endDate, missingForIssue, buildSeaPdf } from "@/lib/seaContract";

const base: any = { application_id: "a", employer_name: "Co", employer_address: "Addr", rank: "Chief Engineer", vessel_name: "MV X", imo_number: "1234567", flag_state: "Panama", vessel_type: "Tanker", port_of_engagement: "Jakarta", repatriation_port: "Jakarta", start_date: "2026-11-01", duration_months: 6, tolerance_months: 1, notice_days: 30, cba_reference: "", currency: "USD", basic_wage: 3000, fixed_overtime: 1000, overtime_hours: 103, extra_ot_rate: 10, leave_days_per_month: 2.5, leave_pay: 250, allowances: [{ label: "Tanker", amount: 200 }], notes: "" };

describe("SEA contract rules", () => {
  it("leave pay uses MLC minimum 2.5 days of basic/30", () => {
    expect(suggestedLeavePay(3000)).toBe(250);
    expect(suggestedLeavePay(3000, 1)).toBe(250);
  });
  it("monthly total sums basic, OT, leave and allowances", () => expect(monthlyTotal(base)).toBe(4450));
  it("end date adds contract months", () => expect(endDate("2026-11-01", 6)).toBe("2027-05-01"));
  it("blocks issue when basic wage or vessel missing", () => {
    expect(missingForIssue(base)).toEqual([]);
    expect(missingForIssue({ ...base, basic_wage: 0, vessel_name: "" })).toEqual(["Vessel name", "Basic wage"]);
  });
  it("builds a PDF", () => expect(buildSeaPdf(base, { name: "A B" }).getNumberOfPages()).toBeGreaterThan(0));
});
