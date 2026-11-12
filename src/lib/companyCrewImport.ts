// Company crew roster import: spreadsheet/CSV rows → validated crew rows for RPC `company_crew_import`.
import { unzipSync, strFromU8 } from "fflate";
import { excelSerialToDate } from "@/lib/xlsxCv";

export type CrewImportRow = {
  first_name: string; last_name: string; rank: string; nationality?: string; email?: string; whatsapp?: string;
  date_of_birth?: string; vessel?: string; available_from?: string; cdc_no?: string; passport_no?: string; notes?: string;
  certificates?: { name: string; number?: string; expiry_date?: string }[];
};
export type ParsedImport = { rows: CrewImportRow[]; problems: { line: number; reason: string }[] };

export const TEMPLATE_HEADERS = ["Full Name", "First Name", "Last Name", "Rank", "Nationality", "Email", "WhatsApp", "Date of Birth", "Vessel", "Available From", "CDC No", "Passport No", "CoC Number", "CoC Expiry", "Medical Expiry", "Passport Expiry", "Notes"];

const KEY: Record<string, keyof CrewImportRow | "full_name" | "coc_no" | "coc_expiry" | "medical_expiry" | "passport_expiry"> = {
  "full name": "full_name", name: "full_name", "crew name": "full_name", "seafarer name": "full_name",
  "first name": "first_name", "given name": "first_name", firstname: "first_name",
  "last name": "last_name", surname: "last_name", "family name": "last_name", lastname: "last_name",
  rank: "rank", position: "rank", designation: "rank",
  nationality: "nationality", country: "nationality",
  email: "email", "e-mail": "email", "email address": "email", "email id": "email",
  whatsapp: "whatsapp", phone: "whatsapp", mobile: "whatsapp", "mobile no": "whatsapp", "phone number": "whatsapp", "whatsapp number": "whatsapp", contact: "whatsapp",
  "date of birth": "date_of_birth", dob: "date_of_birth", birthdate: "date_of_birth",
  vessel: "vessel", "vessel name": "vessel", ship: "vessel", "current vessel": "vessel", "last vessel": "vessel",
  "available from": "available_from", "available date": "available_from", availability: "available_from", "readiness date": "available_from",
  "cdc no": "cdc_no", cdc: "cdc_no", "seaman book": "cdc_no", "seaman book no": "cdc_no", "cdc number": "cdc_no",
  "passport no": "passport_no", passport: "passport_no", "passport number": "passport_no",
  "coc number": "coc_no", "coc no": "coc_no", coc: "coc_no",
  "coc expiry": "coc_expiry", "medical expiry": "medical_expiry", "passport expiry": "passport_expiry",
  notes: "notes", remarks: "notes", comment: "notes",
};

const norm = (h: string) => h.toLowerCase().replace(/[_.*#:]/g, " ").replace(/\s+/g, " ").trim();

/** Accepts DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD.MM.YYYY, 12 Mar 2026 or Excel serials → YYYY-MM-DD. */
export function toIsoDate(v: string): string | undefined {
  const s = String(v || "").trim();
  if (!s) return undefined;
  if (/^\d{5}(\.\d+)?$/.test(s)) return toIsoDate(excelSerialToDate(Number(s)) || "");
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return valid(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2})[\s-]([A-Za-z]{3,})[\s-](\d{4})$/.exec(s);
  if (m) {
    const mon = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(m[2].slice(0, 3).toLowerCase());
    if (mon >= 0) return valid(+m[3], mon + 1, +m[1]);
  }
  return undefined;
}
function valid(y: number, mo: number, d: number) {
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCDate() !== d) return undefined;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function normalisePhone(v: string): string | undefined {
  let s = String(v || "").trim().replace(/[^\d+]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  const digits = s.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return undefined;
  return s.startsWith("+") ? "+" + digits : "+" + digits;
}

export function parseCsv(text: string): string[][] {
  const out: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  const t = text.replace(/^\uFEFF/, "");
  const delim = (t.split("\n")[0].match(/;/g)?.length || 0) > (t.split("\n")[0].match(/,/g)?.length || 0) ? ";" : ",";
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cell); out.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out.filter(r => r.some(c => c.trim()));
}

/** Map a header row + data rows into validated crew rows. Header row = first row containing a name and rank column. */
export function mapRows(table: string[][]): ParsedImport {
  const problems: ParsedImport["problems"] = [];
  const hIdx = table.findIndex(r => { const k = r.map(c => KEY[norm(c)]); return k.includes("rank") && (k.includes("full_name") || k.includes("first_name") || k.includes("last_name")); });
  if (hIdx < 0) return { rows: [], problems: [{ line: 1, reason: "Could not find the header row. It needs at least a Name and a Rank column." }] };
  const cols = table[hIdx].map(c => KEY[norm(c)]);
  const rows: CrewImportRow[] = [];
  for (let i = hIdx + 1; i < table.length; i++) {
    const rec: Record<string, string> = {};
    table[i].forEach((v, j) => { const k = cols[j]; if (k && String(v ?? "").trim()) rec[k] = String(v).trim(); });
    if (!Object.keys(rec).length) continue;
    let first = rec.first_name || ""; let last = rec.last_name || "";
    if (!first && !last && rec.full_name) {
      const parts = rec.full_name.replace(/\s+/g, " ").split(" ");
      last = parts.length > 1 ? parts.pop()! : ""; first = parts.join(" ");
    }
    const line = i + 1;
    if (!first && !last) { problems.push({ line, reason: "Missing name" }); continue; }
    if (!rec.rank) { problems.push({ line, reason: "Missing rank" }); continue; }
    const email = rec.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rec.email.toLowerCase()) ? rec.email.toLowerCase() : undefined;
    if (rec.email && !email) problems.push({ line, reason: `Email "${rec.email}" ignored (not valid)` });
    const whatsapp = rec.whatsapp ? normalisePhone(rec.whatsapp) : undefined;
    if (rec.whatsapp && !whatsapp) problems.push({ line, reason: `Phone "${rec.whatsapp}" ignored (not valid)` });
    const certificates: NonNullable<CrewImportRow["certificates"]> = [];
    if (rec.coc_no || rec.coc_expiry) certificates.push({ name: "Certificate of Competency (CoC)", number: rec.coc_no || "", expiry_date: toIsoDate(rec.coc_expiry || "") || "" });
    if (rec.medical_expiry) certificates.push({ name: "Medical Fitness Certificate", expiry_date: toIsoDate(rec.medical_expiry) || "" });
    if (rec.passport_expiry) certificates.push({ name: "Passport", number: rec.passport_no || "", expiry_date: toIsoDate(rec.passport_expiry) || "" });
    rows.push({
      first_name: first, last_name: last, rank: rec.rank, nationality: rec.nationality, email, whatsapp,
      date_of_birth: toIsoDate(rec.date_of_birth || ""), vessel: rec.vessel, available_from: toIsoDate(rec.available_from || ""),
      cdc_no: rec.cdc_no, passport_no: rec.passport_no, notes: rec.notes, certificates,
    });
  }
  return { rows, problems };
}

/** Duplicate rows inside the same file (same email or phone) are dropped; the first one wins. */
export function dedupeRows(rows: CrewImportRow[]): { rows: CrewImportRow[]; duplicates: number } {
  const seen = new Set<string>(); const out: CrewImportRow[] = []; let duplicates = 0;
  for (const r of rows) {
    const keys = [r.email && `e:${r.email}`, r.whatsapp && `p:${r.whatsapp.replace(/\D/g, "")}`].filter(Boolean) as string[];
    if (keys.some(k => seen.has(k))) { duplicates++; continue; }
    keys.forEach(k => seen.add(k)); out.push(r);
  }
  return { rows: out, duplicates };
}

/** First worksheet of an .xlsx as a cell table (browser, no extra library). */
export async function readXlsxTable(file: File): Promise<string[][]> {
  if (/\.xls$/i.test(file.name)) throw new Error("Old .xls files are not supported. Open it in Excel, “Save As” .xlsx or .csv, then upload again.");
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const get = (p: string) => (files[p] ? strFromU8(files[p]) : "");
  if (!files["xl/workbook.xml"]) throw new Error("This file is not a valid Excel workbook.");
  const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");
  const shared = Array.from(xml(get("xl/sharedStrings.xml")).getElementsByTagName("si")).map(si => Array.from(si.getElementsByTagName("t")).map(t => t.textContent || "").join(""));
  const rels: Record<string, string> = {};
  Array.from(xml(get("xl/_rels/workbook.xml.rels")).getElementsByTagName("Relationship")).forEach(r => { rels[r.getAttribute("Id")!] = r.getAttribute("Target")!; });
  const sheet = xml(get("xl/workbook.xml")).getElementsByTagName("sheet")[0];
  const rid = sheet?.getAttribute("r:id") || sheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || "";
  const target = (rels[rid] || "worksheets/sheet1.xml").replace(/^\/?(xl\/)?/, "");
  const doc = xml(get(`xl/${target}`));
  const out: string[][] = [];
  for (const row of Array.from(doc.getElementsByTagName("row"))) {
    const cells: string[] = [];
    for (const c of Array.from(row.getElementsByTagName("c"))) {
      const ref = c.getAttribute("r") || ""; const letters = ref.replace(/\d+/g, "");
      let idx = 0; for (const ch of letters) idx = idx * 26 + (ch.charCodeAt(0) - 64); idx -= 1;
      const t = c.getAttribute("t"); const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      const val = t === "s" ? shared[Number(v)] ?? "" : t === "inlineStr" ? (c.getElementsByTagName("t")[0]?.textContent ?? "") : v;
      cells[idx >= 0 ? idx : cells.length] = val.replace(/\s+/g, " ").trim();
    }
    out.push(Array.from(cells, c => c ?? ""));
  }
  return out.filter(r => r.some(c => c));
}

export async function readRosterFile(file: File): Promise<ParsedImport & { duplicates: number }> {
  const table = /\.csv$/i.test(file.name) || file.type === "text/csv" ? parseCsv(await file.text()) : await readXlsxTable(file);
  const parsed = mapRows(table);
  const d = dedupeRows(parsed.rows);
  return { rows: d.rows, problems: parsed.problems, duplicates: d.duplicates };
}

export function templateCsv(): string {
  const sample = ["Juan Dela Cruz", "", "", "Chief Officer", "Philippines", "juan@example.com", "+639171234567", "15/04/1985", "MV Ocean Star", "01/12/2026", "C1234567", "P9876543", "COC-12345", "30/06/2028", "15/03/2027", "10/10/2030", ""];
  const esc = (s: string) => /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  return "\uFEFF" + [TEMPLATE_HEADERS, sample].map(r => r.map(esc).join(",")).join("\r\n");
}

export const claimLink = (token: string, origin = "https://seaminds.life") => `${origin}/claim/${token}`;

export function inviteMessage(r: { first_name: string; rank: string; crew_unique_id: string; claim_token: string }, company: string) {
  return `⚓ Hello ${r.rank ? r.rank + " " : ""}${r.first_name},\n\n${company || "Your company"} has created your SeaMinds digital seafarer profile.\nYour Crew ID: ${r.crew_unique_id}\n\nPlease tap the link to review your details and accept with one tap:\n${claimLink(r.claim_token)}\n\nFree for seafarers. You can also decline on the same page.`;
}

export const IMPORT_ERRORS: Record<string, string> = {
  not_a_manager: "Only company accounts can add crew.",
  approval_required: "Your company account is waiting for SeaMinds approval. Crew tools open after approval.",
  no_rows: "No crew rows to add.",
  too_many_rows: "Please upload at most 1,000 crew at a time.",
};
