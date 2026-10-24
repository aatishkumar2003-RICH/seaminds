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
    expect(k.payroll).toEqual({ USD: 1500 });
  });
  it("flags relief due within 30 days, cleared from unplanned once a reliever is nominated", () => {
    expect(buildCockpit([r("a")], [c("a")], today).kpi.reliefUnplanned).toBe(1);
    const d = buildCockpit([r("a"), r("b")], [c("a", { reliever_application_id: "b" })], today);
    expect(d.kpi.reliefDue).toBe(1);
    expect(d.kpi.reliefUnplanned).toBe(0);
    expect(d.rows[0].reliever?.name).toBe("b");
  });
  it("completed contract moves crew to signed off with no payroll", () => {
    const d = buildCockpit([r("a")], [c("a", { status: "completed" })], today);
    expect(d.rows[0].state).toBe("signedoff");
    expect(d.kpi.onboard).toBe(0);
    expect(d.kpi.payroll).toEqual({});
  });
  it("keeps payroll separate per currency", () => {
    const k = buildCockpit([r("a"), r("b")], [c("a"), c("b", { currency: "EUR" })], today).kpi;
    expect(k.payroll).toEqual({ USD: 1500, EUR: 1500 });
  });
  it("reports safe-manning shortfall against required complement", () => {
    const v = buildCockpit([r("a")], [c("a")], today, [{ vessel_name: "MV A", required_complement: 14 }]).vessels[0];
    expect(v.shortfall).toBe(13);
  });
});
