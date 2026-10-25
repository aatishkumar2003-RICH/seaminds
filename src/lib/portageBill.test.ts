import { describe, it, expect } from "vitest";
import { computePortage, daysInMonth, daysServed, totalsByCurrency, type PortageContract } from "./portageBill";

const c: PortageContract = { id: "c", application_id: "a", status: "signed", vessel_name: "V", rank: "AB", currency: "USD", start_date: "2026-10-12", duration_months: 6, basic_wage: 1000, fixed_overtime: 300, leave_pay: 100, extra_ot_rate: 5, allowances: [{ label: "x", amount: 100 }] };
const zero = { extra_ot_hours: 0, bonus: 0, prev_balance: 0, allotment: 0, cash_advance: 0, bond_store: 0, communication: 0, other_deduction: 0 };

describe("portage bill", () => {
  it("counts sign-on day inclusively", () => {
    expect(daysInMonth("2026-10")).toBe(31);
    expect(daysServed("2026-10", "2026-10-12", 6)).toBe(20);
    expect(daysServed("2026-11", "2026-10-12", 6)).toBe(30);
    expect(daysServed("2026-09", "2026-10-12", 6)).toBe(0);
  });
  it("counts sign-off day inclusively", () => {
    expect(daysServed("2027-04", "2026-10-12", 6)).toBe(12);
  });
  it("pro-rates fixed wages and adds extra overtime in full", () => {
    const p = computePortage(c, 15, 30, { ...zero, extra_ot_hours: 10 });
    expect(p.fixed).toBe(750);
    expect(p.extraOt).toBe(50);
    expect(p.gross).toBe(800);
  });
  it("net = earnings + carry-over - deductions", () => {
    const p = computePortage(c, 30, 30, { ...zero, prev_balance: 200, allotment: 800, cash_advance: 100, bond_store: 50 });
    expect(p.gross).toBe(1700);
    expect(p.deductions).toBe(950);
    expect(p.net_payable).toBe(750);
  });
  it("never sums different currencies", () => {
    const t = totalsByCurrency([{ currency: "USD", gross: 10, deductions: 0, net_payable: 10 }, { currency: "EUR", gross: 5, deductions: 0, net_payable: 5 }, { currency: "USD", gross: 1, deductions: 0, net_payable: 1 }]);
    expect(t.USD.net).toBe(11);
    expect(t.EUR.net).toBe(5);
  });
});
