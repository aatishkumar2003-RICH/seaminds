import { jobPath } from "@/lib/jobSlug";

export type BroadcastVacancy = {
  id: string;
  rank_required?: string | null;
  vessel_type?: string | null;
  joining_port?: string | null;
  joining_date?: string | null;
  monthly_salary?: string | null;
  contract_duration?: string | null;
  recruiter_name?: string | null;
  contact_whatsapp?: string | null;
  contact_email?: string | null;
  [k: string]: unknown;
};

const ORIGIN = "https://seaminds.life";

export const vacancyUrl = (v: BroadcastVacancy) =>
  ORIGIN + jobPath({ id: v.id, rank: v.rank_required, vessel: v.vessel_type, port: v.joining_port });

/** Plain-text maritime announcement for WhatsApp channels/groups. */
export const broadcastText = (v: BroadcastVacancy) => {
  const lines = [
    `⚓ *VACANCY: ${(v.rank_required || "Seafarer").toUpperCase()}*`,
    v.vessel_type && `🚢 Vessel: ${v.vessel_type}`,
    v.monthly_salary && `💰 Wage: ${v.monthly_salary}`,
    v.joining_date && `📅 Joining: ${v.joining_date}`,
    v.joining_port && `📍 Port: ${v.joining_port}`,
    v.contract_duration && `⏳ Contract: ${v.contract_duration}`,
    "",
    `👉 Apply: ${vacancyUrl(v)}`,
    "",
    "Shared via SeaMinds — free for seafarers.",
  ];
  return lines.filter((l): l is string => typeof l === "string").join("\n");
};

export const whatsappShareUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** Safe per-message length so a wa.me link opens on every phone. */
export const DIGEST_MAX_CHARS = 1800;

const digestItem = (v: BroadcastVacancy, n: number) =>
  [`${n}. *${(v.rank_required || "Seafarer").toUpperCase()}*${v.vessel_type ? ` — ${v.vessel_type}` : ""}${v.joining_port ? ` · ${v.joining_port}` : ""}`,
    v.monthly_salary ? `   💰 ${v.monthly_salary}` : "",
    `   👉 ${vacancyUrl(v)}`].filter(Boolean).join("\n");

/**
 * One combined announcement for many vacancies, split into parts that each fit
 * one WhatsApp message. Every vacancy appears exactly once across the parts.
 */
export const buildDigests = (rows: BroadcastVacancy[], maxChars = DIGEST_MAX_CHARS): string[] => {
  if (!rows.length) return [];
  const company = rows.find((r) => r.recruiter_name)?.recruiter_name;
  const contactRow = rows.find((r) => r.contact_whatsapp || r.contact_email);
  const footer = [
    "",
    contactRow?.contact_whatsapp ? `📱 Contact: ${contactRow.contact_whatsapp}` : "",
    contactRow?.contact_email ? `✉️ ${contactRow.contact_email}` : "",
    "Shared via SeaMinds — free for seafarers.",
  ].filter((l, i) => i === 0 || l).join("\n");
  const head = (part: number) => `⚓ *CREW REQUIRED${company ? ` — ${company.toUpperCase()}` : ""}*${part > 1 ? ` (part ${part})` : ""}\n`;

  const parts: string[] = [];
  let body: string[] = [];
  const flush = () => { if (body.length) { parts.push(`${head(parts.length + 1)}\n${body.join("\n\n")}\n${footer}`); body = []; } };
  rows.forEach((v, i) => {
    const item = digestItem(v, i + 1);
    const candidate = `${head(parts.length + 1)}\n${[...body, item].join("\n\n")}\n${footer}`;
    if (body.length && candidate.length > maxChars) flush();
    body.push(item);
  });
  flush();
  return parts;
};

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Spreadsheet (opens in Excel) with one vacancy per row. */
export const vacanciesCsv = (rows: BroadcastVacancy[]) => {
  const cols: [string, (v: BroadcastVacancy) => unknown][] = [
    ["Rank", (v) => v.rank_required], ["Vessel type", (v) => v.vessel_type], ["Joining port", (v) => v.joining_port],
    ["Joining date", (v) => v.joining_date], ["Wage", (v) => v.monthly_salary], ["Contract", (v) => v.contract_duration],
    ["Recruiter", (v) => v.recruiter_name], ["WhatsApp", (v) => v.contact_whatsapp], ["Email", (v) => v.contact_email],
    ["Apply link", (v) => vacancyUrl(v)],
  ];
  return "\uFEFF" + [cols.map(([h]) => csvCell(h)).join(","), ...rows.map((r) => cols.map(([, f]) => csvCell(f(r))).join(","))].join("\r\n");
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

/** Printable A4 vacancy list built from data (no screenshots). */
export const vacanciesPdf = async (rows: BroadcastVacancy[], title: string) => {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const clean = (s: unknown) => String(s ?? "").replace(/[^\x20-\x7E]/g, "").trim();
  let y = 18;
  doc.setFontSize(16); doc.text(clean(title) || "Open vacancies", 14, y);
  doc.setFontSize(9); y += 6; doc.text(`${rows.length} vacancies · ${new Date().toISOString().slice(0, 10)} · seaminds.life`, 14, y);
  y += 8;
  rows.forEach((v, i) => {
    if (y > 275) { doc.addPage(); y = 18; }
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}. ${clean(v.rank_required) || "Seafarer"}${v.vessel_type ? ` - ${clean(v.vessel_type)}` : ""}`, 14, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); y += 5;
    const meta = [v.joining_port && `Port: ${clean(v.joining_port)}`, v.joining_date && `Joining: ${clean(v.joining_date)}`, v.monthly_salary && `Wage: ${clean(v.monthly_salary)}`, v.contract_duration && `Contract: ${clean(v.contract_duration)}`].filter(Boolean).join("   ");
    if (meta) { doc.text(doc.splitTextToSize(meta, 182), 14, y); y += 5; }
    const contact = [v.recruiter_name && clean(v.recruiter_name), v.contact_whatsapp && clean(v.contact_whatsapp), v.contact_email && clean(v.contact_email)].filter(Boolean).join(" · ");
    if (contact) { doc.text(doc.splitTextToSize(contact, 182), 14, y); y += 5; }
    doc.setTextColor(30, 80, 160); doc.text(vacancyUrl(v), 14, y); doc.setTextColor(0, 0, 0);
    y += 8;
  });
  return doc.output("blob");
};
