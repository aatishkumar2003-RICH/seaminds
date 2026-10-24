import { jsPDF } from "jspdf";

export type Allowance = { label: string; amount: number };
export type SeaContract = {
  id?: string; application_id: string; status?: string;
  employer_name: string; employer_address: string; rank: string;
  vessel_name: string; imo_number: string; flag_state: string; vessel_type: string;
  port_of_engagement: string; repatriation_port: string; start_date: string | null;
  duration_months: number; tolerance_months: number; notice_days: number; cba_reference: string;
  currency: string; basic_wage: number; fixed_overtime: number; overtime_hours: number;
  extra_ot_rate: number; leave_days_per_month: number; leave_pay: number; allowances: Allowance[];
  notes: string; issued_at?: string | null; signed_at?: string | null;
};
export type SeafarerInfo = { name: string; nationality?: string; dob?: string; passport?: string; cdc?: string; crewId?: string };

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** MLC 2006 A2.4: at least 2.5 calendar days paid leave per month of service. */
export const MLC_MIN_LEAVE_DAYS = 2.5;

/** Leave pay suggestion: basic wage / 30 × leave days per month. */
export function suggestedLeavePay(basic: number, leaveDays = MLC_MIN_LEAVE_DAYS) {
  return r2((Number(basic) || 0) / 30 * Math.max(MLC_MIN_LEAVE_DAYS, leaveDays));
}

export function monthlyTotal(c: Pick<SeaContract, "basic_wage" | "fixed_overtime" | "leave_pay" | "allowances">) {
  const allow = (c.allowances || []).reduce((s, a) => s + (Number(a.amount) || 0), 0);
  return r2((Number(c.basic_wage) || 0) + (Number(c.fixed_overtime) || 0) + (Number(c.leave_pay) || 0) + allow);
}

export function endDate(start: string | null, months: number) {
  if (!start) return null;
  const d = new Date(start + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  const whole = Math.floor(months), days = Math.round((months - whole) * 30);
  d.setUTCMonth(d.getUTCMonth() + whole);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Fields that must be filled before the SEA can be issued to the crew. */
export function missingForIssue(c: SeaContract) {
  const m: string[] = [];
  if (!c.employer_name.trim()) m.push("Employer name");
  if (!c.employer_address.trim()) m.push("Employer address");
  if (!c.rank.trim()) m.push("Rank");
  if (!c.vessel_name.trim()) m.push("Vessel name");
  if (!c.flag_state.trim()) m.push("Flag state");
  if (!c.port_of_engagement.trim()) m.push("Port of engagement");
  if (!c.repatriation_port.trim()) m.push("Repatriation port");
  if (!c.start_date) m.push("Start date");
  if (!(c.basic_wage > 0)) m.push("Basic wage");
  if (c.leave_days_per_month < MLC_MIN_LEAVE_DAYS) m.push("Leave (min 2.5 days/month)");
  return m;
}

const money = (cur: string, n: number) => `${cur} ${r2(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function buildSeaPdf(c: SeaContract, s: SeafarerInfo) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 15; let y = 15;
  const line = () => { pdf.setDrawColor(180); pdf.line(M, y, W - M, y); y += 4; };
  const ensure = (h: number) => { if (y + h > 282) { pdf.addPage(); y = 15; } };
  const heading = (t: string) => { ensure(12); pdf.setFont("helvetica", "bold"); pdf.setFontSize(10.5); pdf.text(t, M, y); y += 2; line(); };
  const row = (k: string, v: string) => {
    pdf.setFontSize(9); pdf.setFont("helvetica", "bold");
    const lines = pdf.splitTextToSize(v || "—", W - 2 * M - 55);
    ensure(lines.length * 4.5 + 1);
    pdf.text(k, M, y); pdf.setFont("helvetica", "normal"); pdf.text(lines, M + 55, y); y += lines.length * 4.5 + 0.5;
  };
  const para = (t: string) => {
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.6);
    const lines = pdf.splitTextToSize(t, W - 2 * M); ensure(lines.length * 4 + 2); pdf.text(lines, M, y); y += lines.length * 4 + 2;
  };

  pdf.setFont("helvetica", "bold"); pdf.setFontSize(15);
  pdf.text("SEAFARER EMPLOYMENT AGREEMENT", W / 2, y, { align: "center" }); y += 6;
  pdf.setFontSize(8.5); pdf.setFont("helvetica", "normal");
  pdf.text("Prepared in line with the Maritime Labour Convention, 2006 (Regulation 2.1, Standard A2.1)", W / 2, y, { align: "center" }); y += 4;
  pdf.text(`Status: ${(c.status || "draft").toUpperCase()}${c.id ? `   Ref: SEA-${c.id.slice(0, 8).toUpperCase()}` : ""}`, W / 2, y, { align: "center" }); y += 6;

  heading("1. Shipowner / Employer");
  row("Name", c.employer_name); row("Address", c.employer_address);
  heading("2. Seafarer");
  row("Full name", s.name); row("Nationality", s.nationality || ""); row("Date of birth", s.dob || "");
  row("Passport no.", s.passport || ""); row("Seaman's book (CDC)", s.cdc || ""); row("SeaMinds crew ID", s.crewId || "");
  heading("3. Vessel and capacity");
  row("Rank / capacity", c.rank); row("Vessel", c.vessel_name); row("IMO number", c.imo_number);
  row("Flag", c.flag_state); row("Vessel type", c.vessel_type);
  heading("4. Engagement");
  row("Place of engagement", c.port_of_engagement); row("Commencement date", c.start_date || "");
  row("Period", `${c.duration_months} month(s) ± ${c.tolerance_months} month(s) at owner's option`);
  row("Expected completion", endDate(c.start_date, c.duration_months) || "");
  row("Termination notice", `${c.notice_days} days written notice by either party (shorter only on compassionate/urgent grounds as per MLC Standard A2.1.5)`);
  row("Repatriation to", c.repatriation_port);
  row("Applicable CBA", c.cba_reference || "None — terms as set out herein");

  heading("5. Monthly wages and allowances");
  const items: [string, number][] = [["Basic wage", c.basic_wage], [`Guaranteed overtime${c.overtime_hours ? ` (${c.overtime_hours} hrs)` : ""}`, c.fixed_overtime], [`Leave pay (${c.leave_days_per_month} days/month)`, c.leave_pay], ...(c.allowances || []).filter(a => a.label).map(a => [a.label, a.amount] as [string, number])];
  pdf.setFontSize(9);
  items.forEach(([k, v]) => { ensure(5); pdf.setFont("helvetica", "normal"); pdf.text(k, M, y); pdf.text(money(c.currency, v), W - M, y, { align: "right" }); y += 5; });
  line();
  pdf.setFont("helvetica", "bold"); pdf.text("Total guaranteed monthly remuneration", M, y); pdf.text(money(c.currency, monthlyTotal(c)), W - M, y, { align: "right" }); y += 5;
  if (c.extra_ot_rate > 0) { pdf.setFont("helvetica", "normal"); pdf.text(`Overtime beyond guaranteed hours: ${money(c.currency, c.extra_ot_rate)} per hour`, M, y); y += 5; }
  y += 2;

  heading("6. Standard terms");
  [
    "Hours of work and rest: in accordance with MLC Regulation 2.3 — maximum 14 hours work in any 24 hours and 72 hours in any 7 days, or minimum 10 hours rest in any 24 hours and 77 hours in any 7 days. Records shall be kept and made available to the seafarer.",
    `Paid annual leave: not less than ${c.leave_days_per_month} calendar days per month of employment (MLC Standard A2.4).`,
    "Wages: paid at intervals not exceeding one month, with a monthly account showing wages, deductions and allotments (MLC Standard A2.2). Allotments to family shall be arranged on the seafarer's request.",
    "Repatriation: at no cost to the seafarer on completion, termination, illness/injury, shipwreck, or when the employer cannot fulfil its obligations (MLC Regulation 2.5). Maximum service period on board without repatriation shall be less than 12 months.",
    "Medical care and social protection: medical care on board and ashore free of charge, sick pay and protection against financial consequences of sickness, injury or death in connection with employment (MLC Regulations 4.1, 4.2 and 4.5).",
    "Financial security: the vessel shall carry valid certificates of financial security for repatriation and for contractual claims for death or long-term disability (MLC Standards A2.5.2 and A4.2.1).",
    "Complaints: the seafarer may raise on-board or onshore complaints without victimisation (MLC Regulation 5.1.5). Disputes may also be raised through the SeaMinds lineup ticket channel.",
    "The seafarer has had the opportunity to examine and seek advice on this agreement before signing, and receives a signed original.",
  ].forEach(t => para("• " + t));
  if (c.notes.trim()) { heading("7. Additional terms"); para(c.notes.trim()); }

  ensure(40); y += 8;
  pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
  const half = (W - 2 * M) / 2;
  pdf.line(M, y + 15, M + half - 10, y + 15); pdf.line(M + half + 10, y + 15, W - M, y + 15);
  pdf.text("For the Employer / Authorised Agent", M, y + 20); pdf.text("Seafarer", M + half + 10, y + 20);
  pdf.text("Name, signature, stamp & date", M, y + 25); pdf.text(`${s.name || ""} — signature & date`, M + half + 10, y + 25);
  y += 32;
  pdf.setFontSize(7); pdf.setTextColor(120);
  para("Template generated by SeaMinds for convenience. The employer is responsible for verifying it against flag-state law, the applicable CBA and its own approved SEA form before signature.");
  return pdf;
}
