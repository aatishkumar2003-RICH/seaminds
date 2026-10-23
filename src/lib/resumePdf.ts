// Vector A4 CV builder: crisp selectable text, real pagination, repeating headers, embedded photo.
import type { jsPDF as JsPDF } from "jspdf";

type Row = Record<string, any>;
export interface ResumePdfInput {
  personal: Row; sea: Row[]; certs: Row[]; edu: Row[]; training: Row[]; skills: Row;
  photo?: string | null; cvUid: string; declaration?: { name?: string; acceptedAt?: string } | null;
}

const NAVY: [number, number, number] = [13, 27, 42];
const GOLD: [number, number, number] = [212, 175, 55];
const GREY: [number, number, number] = [90, 100, 115];
const LINE: [number, number, number] = [220, 224, 230];

const fmt = (d?: string) => {
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return d;
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m[2] - 1];
  return `${m[3]} ${mon} ${m[1]}`;
};

async function toDataUrl(src: string): Promise<string | null> {
  if (src.startsWith("data:")) return src;
  try {
    const blob = await (await fetch(src)).blob();
    return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.onerror = () => r(null); fr.readAsDataURL(blob); });
  } catch { return null; }
}

// Re-encode to JPEG via canvas so any browser format (webp/heic-decoded) embeds safely.
async function normalisePhoto(src: string): Promise<string | null> {
  const data = await toDataUrl(src);
  if (!data) return null;
  return await new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const W = 350, H = 450; const c = document.createElement("canvas"); c.width = W; c.height = H;
      const ctx = c.getContext("2d"); if (!ctx) return resolve(null);
      const s = Math.max(W / img.width, H / img.height);
      const w = img.width * s, h = img.height * s;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      resolve(c.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => resolve(null);
    img.src = data;
  });
}

export async function buildResumePdf(input: ResumePdfInput): Promise<JsPDF> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const PW = 210, PH = 297, M = 12, CW = PW - M * 2;
  const p = input.personal;
  const fullName = `${p.firstName || ""} ${p.lastName || ""}`.trim().toUpperCase() || "SEAFARER";
  const rank = (p.rank || "").trim();
  let y = 0;

  const runningHeader = () => {
    pdf.setFillColor(...NAVY); pdf.rect(0, 0, PW, 10, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(255, 255, 255);
    pdf.text(`${fullName}${rank ? "  •  " + rank.toUpperCase() : ""}`, M, 6.5);
    pdf.setTextColor(...GOLD); pdf.text(`CV UID: ${input.cvUid}`, PW - M, 6.5, { align: "right" });
    y = 16;
  };
  const ensure = (h: number, onBreak?: () => void) => {
    if (y + h > PH - 14) { pdf.addPage(); runningHeader(); onBreak?.(); }
  };
  const section = (title: string) => {
    ensure(14);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10.5); pdf.setTextColor(...NAVY);
    pdf.text(title.toUpperCase(), M, y + 4);
    pdf.setDrawColor(...GOLD); pdf.setLineWidth(0.6); pdf.line(M, y + 6, PW - M, y + 6);
    y += 10;
  };

  // ── Page 1 header ──
  pdf.setFillColor(...NAVY); pdf.rect(0, 0, PW, 52, "F");
  pdf.setFillColor(...GOLD); pdf.rect(0, 52, PW, 1.2, "F");
  const photo = input.photo ? await normalisePhoto(input.photo) : null;
  const phX = PW - M - 33, phY = 8;
  if (photo) {
    pdf.setFillColor(255, 255, 255); pdf.rect(phX - 0.8, phY - 0.8, 34.6, 39.6, "F");
    pdf.addImage(photo, "JPEG", phX, phY, 33, 38);
  } else {
    pdf.setDrawColor(...GOLD); pdf.rect(phX, phY, 33, 38);
    pdf.setFontSize(7); pdf.setTextColor(...GOLD); pdf.text("PHOTO", phX + 16.5, phY + 20, { align: "center" });
  }
  pdf.setFont("helvetica", "bold"); pdf.setTextColor(255, 255, 255);
  let nameSize = 20; pdf.setFontSize(nameSize);
  while (pdf.getTextWidth(fullName) > CW - 40 && nameSize > 13) pdf.setFontSize(--nameSize);
  const nameLines = pdf.splitTextToSize(fullName, CW - 40) as string[];
  pdf.text(nameLines, M, 17);
  let hy = 17 + nameLines.length * nameSize * 0.42;
  if (rank) {
    pdf.setFontSize(11); pdf.setTextColor(...GOLD); pdf.text(rank.toUpperCase(), M, hy + 2); hy += 7;
  }
  const seeking = (p.applyingFor || "").trim();
  if (seeking && seeking.toLowerCase() !== rank.toLowerCase()) {
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(220, 225, 232);
    pdf.text(`Applying for: ${seeking}`, M, hy); hy += 5;
  }
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setTextColor(220, 225, 232);
  const contact = [p.phone && `WhatsApp: ${p.phone}`, p.email && `Email: ${p.email}`].filter(Boolean).join("    ");
  if (contact) { pdf.text(pdf.splitTextToSize(contact, CW - 40), M, Math.max(hy, 38)); }
  pdf.setFont("helvetica", "bold"); pdf.setTextColor(...GOLD); pdf.setFontSize(8);
  pdf.text(`SeaMinds CV UID: ${input.cvUid}`, M, 48);
  y = 60;

  // ── Personal details grid ──
  const kv: [string, string][] = ([
    ["Nationality", p.nationality], ["Date of Birth", fmt(p.dob)], ["Gender", p.gender],
    ["Passport No.", p.passportNo], ["Seaman Book / CDC", [p.cdcNo, p.cdcCountry].filter(Boolean).join(" — ")],
    ["Available From", fmt(p.availableFrom)], ["Address", p.address],
    ["Emergency Contact", [p.emergencyName, p.emergencyPhone].filter(Boolean).join(" — ")],
  ] as [string, string][]).filter(([, v]) => v && String(v).trim());
  if (kv.length) {
    section("Personal Details");
    const colW = CW / 2;
    for (let i = 0; i < kv.length; i += 2) {
      const pair = kv.slice(i, i + 2);
      const heights = pair.map(([, v]) => (pdf.splitTextToSize(String(v), colW - 36) as string[]).length);
      const h = Math.max(...heights) * 4 + 2;
      ensure(h);
      pair.forEach(([k, v], j) => {
        const x = M + j * colW;
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(...GREY); pdf.text(k, x, y + 3);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(20, 20, 20);
        pdf.text(pdf.splitTextToSize(String(v), colW - 36), x + 34, y + 3);
      });
      y += h;
    }
    y += 2;
  }

  if (p.summary?.trim()) {
    section("Professional Summary");
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(30, 30, 30);
    for (const line of pdf.splitTextToSize(p.summary.trim(), CW) as string[]) { ensure(4.5); pdf.text(line, M, y + 3); y += 4.3; }
    y += 2;
  }

  // ── Generic table with auto-hidden empty columns + repeating header ──
  const table = (title: string, cols: { key: string; label: string; w: number; map?: (r: Row) => string }[], rows: Row[]) => {
    const val = (c: typeof cols[0], r: Row) => String((c.map ? c.map(r) : r[c.key]) ?? "").trim();
    const live = rows.filter(r => cols.some(c => val(c, r)));
    if (!live.length) return;
    const used = cols.filter(c => live.some(r => val(c, r)));
    const total = used.reduce((s, c) => s + c.w, 0);
    const widths = used.map(c => (c.w / total) * CW);
    section(title);
    const head = () => {
      pdf.setFillColor(...NAVY); pdf.rect(M, y, CW, 6.5, "F");
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setTextColor(255, 255, 255);
      let x = M; used.forEach((c, i) => { pdf.text(c.label, x + 1.5, y + 4.4); x += widths[i]; });
      y += 6.5;
    };
    ensure(14); head();
    live.forEach((r, ri) => {
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.8);
      const cells = used.map((c, i) => pdf.splitTextToSize(val(c, r) || "—", widths[i] - 3) as string[]);
      const h = Math.max(...cells.map(c => c.length)) * 3.5 + 2.5;
      ensure(h, head);
      if (ri % 2) { pdf.setFillColor(246, 248, 251); pdf.rect(M, y, CW, h, "F"); }
      pdf.setTextColor(25, 25, 25);
      let x = M; cells.forEach((c, i) => { pdf.text(c, x + 1.5, y + 3.6); x += widths[i]; });
      pdf.setDrawColor(...LINE); pdf.setLineWidth(0.2); pdf.line(M, y + h, M + CW, y + h);
      y += h;
    });
    y += 4;
  };

  table("Sea Service", [
    { key: "vesselName", label: "Vessel", w: 22 },
    { key: "rankOnBoard", label: "Rank", w: 18 },
    { key: "vesselType", label: "Type", w: 16 },
    { key: "grtDwt", label: "GRT/DWT", w: 12 },
    { key: "flagState", label: "Flag", w: 10 },
    { key: "engineType", label: "Engine", w: 14 },
    { key: "company", label: "Company", w: 20 },
    { key: "fromDate", label: "Sign On", w: 13, map: r => fmt(r.fromDate) },
    { key: "toDate", label: "Sign Off", w: 13, map: r => fmt(r.toDate) },
  ], input.sea);

  const today = new Date().toISOString().slice(0, 10);
  table("Certificates & Licences", [
    { key: "name", label: "Certificate", w: 34 },
    { key: "number", label: "Number", w: 20 },
    { key: "issuingAuthority", label: "Issued By", w: 18 },
    { key: "issueDate", label: "Issued", w: 13, map: r => fmt(r.issueDate) },
    { key: "expiryDate", label: "Expiry", w: 15, map: r => {
      const e = r.expiryDate; if (!e) return "";
      return /^\d{4}-/.test(e) && e < today ? `${fmt(e)} (check)` : fmt(e);
    } },
  ], input.certs.filter(c => c.name && (c.number || c.issueDate || c.expiryDate)));

  table("Education", [
    { key: "institution", label: "Institution", w: 40 },
    { key: "qualification", label: "Qualification", w: 40 },
    { key: "years", label: "Years", w: 20, map: r => [r.yearFrom, r.yearTo].filter(Boolean).join(" – ") },
  ], input.edu);

  table("Training Courses", [
    { key: "courseName", label: "Course", w: 40 },
    { key: "institution", label: "Institution", w: 30 },
    { key: "dateCompleted", label: "Completed", w: 15, map: r => fmt(r.dateCompleted) },
    { key: "certNo", label: "Cert No.", w: 15 },
  ], input.training);

  const s = input.skills || {};
  const skillLines = ([
    ["Languages", (s.languages || []).map((l: Row) => `${l.language}${l.level ? ` (${l.level})` : ""}`).join(", ")],
    ["ECDIS", (s.ecdis || []).join(", ")], ["Engine Types", s.engineTypes], ["Cargo Experience", s.cargoTypes],
    ["Computer Skills", s.computerSkills], ["Other", s.other],
  ] as [string, string][]).filter(([, v]) => v && String(v).trim());
  if (skillLines.length) {
    section("Skills");
    for (const [k, v] of skillLines) {
      const lines = pdf.splitTextToSize(String(v), CW - 36) as string[];
      ensure(lines.length * 4 + 1);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(...GREY); pdf.text(k, M, y + 3);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(20, 20, 20); pdf.text(lines, M + 36, y + 3);
      y += lines.length * 4 + 1;
    }
    y += 2;
  }

  // ── Declaration ──
  section("Crew Declaration");
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(40, 40, 40);
  const decl = "I confirm that the information and certificates in this CV are true and correct to the best of my knowledge. I take sole responsibility for their accuracy. SeaMinds compiles this CV from data provided by the seafarer and does not verify original documents.";
  const dl = pdf.splitTextToSize(decl, CW) as string[]; ensure(dl.length * 3.6 + 6);
  pdf.text(dl, M, y + 3); y += dl.length * 3.6 + 2;
  pdf.setFont("helvetica", "bold");
  const who = input.declaration?.name || fullName;
  const when = input.declaration?.acceptedAt ? new Date(input.declaration.acceptedAt).toLocaleDateString("en-GB") : "—";
  pdf.text(`Confirmed electronically by: ${who}   •   Date: ${when}`, M, y + 3);

  // ── Footers ──
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...LINE); pdf.line(M, PH - 10, PW - M, PH - 10);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(...GREY);
    pdf.text(`Generated by SeaMinds • seaminds.life • ${new Date().toLocaleDateString("en-GB")}`, M, PH - 6);
    pdf.text(`Page ${i} of ${n}`, PW - M, PH - 6, { align: "right" });
  }
  return pdf;
}
