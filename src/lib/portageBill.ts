import { jsPDF } from "jspdf";
import { endDate, monthlyTotal, type Allowance } from "./seaContract";

export type PortageContract = {
  id: string; application_id: string; status: string; vessel_name: string; rank: string; currency: string;
  start_date: string | null; duration_months: number; basic_wage: number; fixed_overtime: number;
  leave_pay: number; extra_ot_rate: number; allowances: Allowance[];
};
export type PortageInputs = {
  extra_ot_hours: number; bonus: number; prev_balance: number;
  allotment: number; cash_advance: number; bond_store: number; communication: number; other_deduction: number;
};
export type PortageEntry = PortageInputs & {
  id?: string; contract_id: string; year_month: string; days_served: number; days_in_month: number;
  gross: number; deductions: number; net_payable: number; currency: string; status: string; notes: string;
};

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const n = (v: unknown) => Math.max(0, Number(v) || 0);

export function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Days served in the month, counting both sign-on and sign-off days. `signOff` overrides the contract end. */
export function daysServed(ym: string, start: string | null, months: number, signOff?: string | null) {
  if (!start) return 0;
  const dim = daysInMonth(ym);
  const mStart = `${ym}-01`, mEnd = `${ym}-${String(dim).padStart(2, "0")}`;
  const end = signOff || endDate(start, months) || mEnd;
  const from = start > mStart ? start : mStart;
  const to = end < mEnd ? end : mEnd;
  if (from > to) return 0;
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000) + 1;
}

/** Fixed monthly wages are pro-rated by days served / days in month; extra OT, bonus and carry-over are added in full. */
export function computePortage(c: PortageContract, days: number, dim: number, i: PortageInputs) {
  const factor = dim > 0 ? Math.min(1, n(days) / dim) : 0;
  const fixed = r2(monthlyTotal(c) * factor);
  const extraOt = r2(n(i.extra_ot_hours) * n(c.extra_ot_rate));
  const gross = r2(fixed + extraOt + n(i.bonus) + (Number(i.prev_balance) || 0));
  const deductions = r2(n(i.allotment) + n(i.cash_advance) + n(i.bond_store) + n(i.communication) + n(i.other_deduction));
  return { fixed, extraOt, gross, deductions, net_payable: r2(gross - deductions) };
}

/** Totals per currency — never summed across currencies. */
export function totalsByCurrency(entries: Pick<PortageEntry, "currency" | "gross" | "deductions" | "net_payable">[]) {
  const out: Record<string, { gross: number; deductions: number; net: number; count: number }> = {};
  for (const e of entries) {
    const t = (out[e.currency] ||= { gross: 0, deductions: 0, net: 0, count: 0 });
    t.gross = r2(t.gross + e.gross); t.deductions = r2(t.deductions + e.deductions); t.net = r2(t.net + e.net_payable); t.count++;
  }
  return out;
}

const money = (cur: string, v: number) => `${cur} ${r2(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthLabel = (ym: string) => new Date(ym + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** MLC 2006 Standard A2.2 monthly account of wages for one seafarer. */
export function buildPayslipPdf(c: PortageContract, e: PortageEntry, crewName: string, employer: string) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 18; let y = 20;
  const p = computePortage(c, e.days_served, e.days_in_month, e);
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(15); pdf.text("Monthly Account of Wages", M, y); y += 6;
  pdf.setFontSize(9); pdf.setFont("helvetica", "normal"); pdf.text("MLC 2006, Standard A2.2", M, y); y += 9;
  const meta: [string, string][] = [["Employer", employer || "-"], ["Seafarer", crewName], ["Rank", c.rank || "-"], ["Vessel", c.vessel_name || "-"], ["Period", monthLabel(e.year_month)], ["Days served", `${e.days_served} of ${e.days_in_month}`], ["Status", e.status]];
  pdf.setFontSize(10);
  meta.forEach(([k, v]) => { pdf.setFont("helvetica", "bold"); pdf.text(k, M, y); pdf.setFont("helvetica", "normal"); pdf.text(String(v), M + 40, y); y += 5.5; });
  y += 4;
  const sec = (title: string, rows: [string, number][], totalLabel: string, total: number) => {
    pdf.setFont("helvetica", "bold"); pdf.text(title, M, y); y += 2; pdf.line(M, y, W - M, y); y += 5;
    pdf.setFont("helvetica", "normal");
    rows.filter(r => r[1] !== 0).forEach(([k, v]) => { pdf.text(k, M, y); pdf.text(money(e.currency, v), W - M, y, { align: "right" }); y += 5; });
    pdf.setFont("helvetica", "bold"); pdf.text(totalLabel, M, y); pdf.text(money(e.currency, total), W - M, y, { align: "right" }); y += 9;
  };
  sec("Earnings", [["Fixed monthly wages (pro-rated)", p.fixed], [`Extra overtime (${e.extra_ot_hours} h)`, p.extraOt], ["Bonus", n(e.bonus)], ["Balance brought forward", Number(e.prev_balance) || 0]], "Total earnings", p.gross);
  sec("Deductions", [["Home allotment", n(e.allotment)], ["Cash advance on board", n(e.cash_advance)], ["Bond store / slop chest", n(e.bond_store)], ["Communication", n(e.communication)], ["Other", n(e.other_deduction)]], "Total deductions", p.deductions);
  pdf.setFontSize(12); pdf.text("Net balance payable", M, y); pdf.text(money(e.currency, p.net_payable), W - M, y, { align: "right" }); y += 8;
  pdf.setFontSize(8); pdf.setFont("helvetica", "normal");
  pdf.text("Exchange rates, if any, are applied at the rate stated in the seafarer employment agreement. Generated by SeaMinds.", M, y);
  return pdf;
}

/** Vessel portage bill summary: one line per crew, totals per currency. */
export function buildVesselPortagePdf(vessel: string, ym: string, lines: { name: string; rank: string; e: PortageEntry }[], employer: string) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = 297, M = 12; let y = 16;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.text(`Portage Bill — ${vessel}`, M, y);
  pdf.setFontSize(9); pdf.setFont("helvetica", "normal"); pdf.text(`${monthLabel(ym)} · ${employer || ""}`, W - M, y, { align: "right" }); y += 9;
  const cols = [["Crew", M], ["Rank", M + 55], ["Days", M + 95], ["Earnings", M + 130], ["Allotment", M + 160], ["Advance", M + 188], ["Other ded.", M + 216], ["Net payable", W - M]] as const;
  pdf.setFont("helvetica", "bold");
  cols.forEach(([h, x], i) => pdf.text(h, x, y, i >= 2 ? { align: "right" } : undefined)); y += 2; pdf.line(M, y, W - M, y); y += 5;
  pdf.setFont("helvetica", "normal");
  for (const { name, rank, e } of lines) {
    if (y > 190) { pdf.addPage(); y = 16; }
    const other = r2(n(e.bond_store) + n(e.communication) + n(e.other_deduction));
    const vals = [name.slice(0, 30), rank.slice(0, 22), String(e.days_served), money(e.currency, e.gross), money(e.currency, n(e.allotment)), money(e.currency, n(e.cash_advance)), money(e.currency, other), money(e.currency, e.net_payable)];
    cols.forEach(([, x], i) => pdf.text(vals[i], x, y, i >= 2 ? { align: "right" } : undefined)); y += 5.5;
  }
  y += 2; pdf.line(M, y, W - M, y); y += 6; pdf.setFont("helvetica", "bold");
  Object.entries(totalsByCurrency(lines.map(l => l.e))).forEach(([cur, t]) => {
    pdf.text(`Total ${cur} (${t.count} crew)`, M, y); pdf.text(money(cur, t.gross), M + 130, y, { align: "right" }); pdf.text(money(cur, t.net), W - M, y, { align: "right" }); y += 6;
  });
  return pdf;
}
