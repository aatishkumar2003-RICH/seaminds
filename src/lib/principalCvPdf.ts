// Principal-style tabular CV presets built from the one SeaMinds Master Crew Record.
// Layouts are "style" approximations, not official principal forms.
import type { jsPDF as JsPDF } from "jspdf";

type Row = Record<string, any>;
export type PrincipalPreset = "anglo" | "synergy";
export interface MasterRecord { personal: Row; sea: Row[]; certs: Row[]; edu: Row[]; skills: Row; photo?: string | null; cv_uid?: string; profile?: Row; declaration?: Row | null }

interface Col { key: string; label: string; w: number; get: (r: Row) => string }
export const fmtDate = (d?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (d || "");
};

const SEA_COLS: Record<PrincipalPreset, Col[]> = {
  anglo: [
    { key: "vessel", label: "Vessel / IMO", w: 30, get: r => [r.vesselName, r.imoNumber].filter(Boolean).join("\n") },
    { key: "flag", label: "Flag", w: 16, get: r => r.flagState || "" },
    { key: "type", label: "Type", w: 20, get: r => r.vesselType || "" },
    { key: "dwt", label: "GRT/DWT", w: 17, get: r => r.grtDwt || "" },
    { key: "engine", label: "Engine / kW", w: 26, get: r => r.engineType || "" },
    { key: "rank", label: "Rank", w: 19, get: r => r.rankOnBoard || "" },
    { key: "from", label: "Sign-on", w: 17, get: r => fmtDate(r.fromDate) },
    { key: "to", label: "Sign-off", w: 17, get: r => fmtDate(r.toDate) },
    { key: "reason", label: "Reason", w: 20, get: r => r.reasonForLeaving || "" },
  ],
  synergy: [
    { key: "vessel", label: "Vessel", w: 28, get: r => r.vesselName || "" },
    { key: "type", label: "Type / Cargo", w: 28, get: r => [r.vesselType, ...(r.cargoTypes || [])].filter(Boolean).join(", ") },
    { key: "dwt", label: "DWT", w: 16, get: r => r.grtDwt || "" },
    { key: "engine", label: "Main Engine", w: 24, get: r => r.engineType || "" },
    { key: "rank", label: "Rank", w: 18, get: r => r.rankOnBoard || "" },
    { key: "period", label: "Period", w: 30, get: r => `${fmtDate(r.fromDate)} – ${fmtDate(r.toDate)}` },
    { key: "vetting", label: "SIRE / PSC", w: 22, get: r => [r.vettingInspections && `SIRE ${r.vettingInspections}`, r.pscInspections && `PSC ${r.pscInspections}`, r.pscDetentions && `Det ${r.pscDetentions}`].filter(Boolean).join(" ") },
    { key: "mgr", label: "Manager", w: 16, get: r => r.company || r.manningAgent || "" },
  ],
};

export const PRESETS: Record<PrincipalPreset, { title: string; note: string }> = {
  anglo: { title: "Anglo-Eastern style — Crew Bio-data", note: "Matrix layout: documents, sea service with engine/power and sign-off reasons." },
  synergy: { title: "Synergy style — Crew Bio-data", note: "Tanker/vetting focus: cargo types, SIRE and PSC experience per vessel." },
};

export const seaColumns = (p: PrincipalPreset) => SEA_COLS[p];

/** Fields a principal expects that are still empty — shown to the manager before export. */
export function missingForPrincipal(m: MasterRecord): string[] {
  const p = m.personal || {}; const out: string[] = [];
  if (!p.firstName && !m.profile?.first_name) out.push("Name");
  if (!p.dob) out.push("Date of birth");
  if (!p.passportNo) out.push("Passport no.");
  if (!p.cdcNo) out.push("Seaman book / CDC");
  if (!m.photo) out.push("Photo");
  if (!(m.sea || []).some(s => s.vesselName)) out.push("Sea service");
  if (!(m.certs || []).some(c => c.number || c.expiryDate)) out.push("Certificate numbers / expiry");
  return out;
}

export async function buildPrincipalPdf(m: MasterRecord, preset: PrincipalPreset, company: string): Promise<JsPDF> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const PW = 297, PH = 210, M = 12; let y = 0;
  const p = m.personal || {};
  const name = [p.firstName || m.profile?.first_name, p.lastName || m.profile?.last_name].filter(Boolean).join(" ") || "Crew";
  const rank = p.rank || m.profile?.rank || "";
  const header = () => {
    pdf.setFillColor(13, 27, 42); pdf.rect(0, 0, PW, 12, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(255, 255, 255);
    pdf.text(`${PRESETS[preset].title}  •  ${name}${rank ? " — " + rank : ""}`, M, 8);
    pdf.setTextColor(212, 175, 55); pdf.text(`Submitted by ${company || "Manning agent"}`, PW - M, 8, { align: "right" });
    y = 18;
  };
  const ensure = (h: number) => { if (y + h > PH - 12) { pdf.addPage(); header(); return true; } return false; };
  const title = (t: string) => { ensure(10); pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(13, 27, 42); pdf.text(t.toUpperCase(), M, y + 4); pdf.setDrawColor(212, 175, 55); pdf.line(M, y + 5.5, PW - M, y + 5.5); y += 8; };
  const table = (cols: Col[], rows: Row[]) => {
    const total = cols.reduce((a, c) => a + c.w, 0); const scale = (PW - 2 * M) / total;
    const head = () => { pdf.setFillColor(235, 238, 243); pdf.rect(M, y, PW - 2 * M, 6, "F"); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setTextColor(13, 27, 42); let x = M; cols.forEach(c => { pdf.text(c.label, x + 1, y + 4); x += c.w * scale; }); y += 6; };
    head();
    pdf.setFont("helvetica", "normal");
    for (const r of rows) {
      const cells = cols.map(c => pdf.splitTextToSize(c.get(r) || "—", c.w * scale - 2) as string[]);
      const h = Math.max(...cells.map(l => l.length)) * 3.4 + 2;
      if (ensure(h)) head();
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(25, 25, 25);
      let x = M; cells.forEach((l, i) => { pdf.text(l, x + 1, y + 3.5); x += cols[i].w * scale; });
      pdf.setDrawColor(220, 224, 230); pdf.line(M, y + h, PW - M, y + h); y += h;
    }
    y += 4;
  };

  header();
  title("Personal & travel documents");
  table([
    { key: "a", label: "Field", w: 40, get: r => r.k }, { key: "b", label: "Value", w: 90, get: r => r.v },
    { key: "c", label: "Field", w: 40, get: r => r.k2 }, { key: "d", label: "Value", w: 90, get: r => r.v2 },
  ], [
    { k: "Full name", v: name, k2: "Rank", v2: rank },
    { k: "Date of birth", v: fmtDate(p.dob), k2: "Nationality", v2: p.nationality || m.profile?.nationality || "" },
    { k: "Passport no.", v: p.passportNo || "", k2: "Seaman book / CDC", v2: [p.cdcNo, p.cdcCountry].filter(Boolean).join(" — ") },
    { k: "Available from", v: fmtDate(p.availableFrom), k2: "SeaMinds Crew ID", v2: m.cv_uid || m.profile?.crew_unique_id || "" },
    ...(preset === "anglo" ? [{ k: "Boiler suit / Shoe", v: [p.boilerSuitSize, p.shoeSize].filter(Boolean).join(" / ") || "To be confirmed", k2: "Height / Weight", v2: [p.height, p.weight].filter(Boolean).join(" / ") || "To be confirmed" }] : []),
  ]);
  title("Certificates of competency & STCW");
  table([
    { key: "n", label: "Certificate", w: 80, get: r => r.name || "" }, { key: "no", label: "Number", w: 45, get: r => r.number || "" },
    { key: "f", label: "Issued by / Flag", w: 50, get: r => [r.issuingAuthority, r.flagState].filter(Boolean).join(" / ") },
    { key: "i", label: "Issued", w: 30, get: r => fmtDate(r.issueDate) }, { key: "e", label: "Expiry", w: 30, get: r => fmtDate(r.expiryDate) || "Unlimited" },
  ], (m.certs || []).filter(c => c.name && (c.number || c.issueDate || c.expiryDate)));
  title("Sea service");
  table(SEA_COLS[preset], (m.sea || []).filter(s => s.vesselName));
  ensure(14);
  pdf.setFont("helvetica", "italic"); pdf.setFontSize(7.5); pdf.setTextColor(90, 100, 115);
  const decl = m.declaration?.acceptedAt ? `Crew declared CV accuracy on ${fmtDate(m.declaration.acceptedAt)}. ` : "";
  pdf.text(`${decl}Generated from the SeaMinds Master Crew Record. Manning agent to verify originals before submission.`, M, y + 4);
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) { pdf.setPage(i); pdf.setFontSize(7); pdf.text(`Page ${i} of ${n}`, PW - M, PH - 6, { align: "right" }); }
  return pdf;
}
