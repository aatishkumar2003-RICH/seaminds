import { describe, it, expect } from "vitest";
import { buildCockpit, mlcBand } from "./fleetCockpit";

const today = new Date("2026-10-24T00:00:00Z");
const r = (id: string, extra = {}) => ({ application_id: id, outcome: "placed", crew_name: id, rank: "AB", nationality: "VN", vessel: "MV A", joining_date: null, crew_confirmed: true, ...extra });
const c = (id: string, extra = {}) => ({ application_id: id, status: "signed", vessel_name: "MV A", imo_number: "1", flag_state: "PA", vessel_type: "Bulk", start_date: "2026-05-01", duration_months: 6, currency: "USD", basic_wage: 1000, fixed_overtime: 500, leave_pay: 0, allowances: [], ...extra });

describe("fleet cockpit", () => {
  it("MLC bands at 180 and 270 days", () => {
    expect(mlcBand(180)).toBe("ok");
    expect(mlcBand(181)).toBe("plan");
    expect(mlcBand(271)).toBe("critical");
  });
  it("counts onboard, lineup and payroll only from signed contracts", () => {
    const k = buildCockpit([r("a"), r("b"), r("c", { crew_confirmed: false })], [c("a"), c("b", { status: "issued", start_date: "2026-12-01" })], today).kpi;
    expect(k.onboard).toBe(1);
    expect(k.lineup).toBe(1);
    expect(k.payroll).toBe(1500);
  });
  it("flags relief due within 30 days", () => {
    const k = buildCockpit([r("a")], [c("a")], today).kpi; // ends 2026-11-01
    expect(k.reliefDue).toBe(1);
  });
});
