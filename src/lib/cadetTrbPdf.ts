// Cadet e-TRB PDF: "summary" = 1–2 page progress record by phase; "full" = all 32 modules with checklists.
import { CADET_CURRICULUM, stageLabel, type CadetTrack } from "@/lib/cadetCurriculum";

export type TrbMode = "summary" | "full" | "clearance";
export type TrbResult = { week: number; score: number; correct?: number; total?: number; attempts?: number; checklist?: boolean[]; officer_name?: string | null; completed_at: string };
export type TrbInput = { name: string; email?: string | null; company?: string | null; vessel?: string | null; imo?: string | null; track: CadetTrack; current_week: number; shore_start?: string | null; join_date?: string | null; results: TrbResult[] };

export const TRB_PHASES: [string, number, number][] = [
  ["Phase 1 · Pre-joining shore induction", 1, 4], ["Phase 2 · Shipboard watchkeeping foundations", 5, 12],
  ["Phase 3 · Cargo, safety & machinery", 13, 24], ["Phase 4 · Pre-sign-off preparation", 25, 32]];

/** Phase completion counts from results — shared by PDF and share text. */
export function phaseStats(results: TrbResult[]) {
  const done = new Set(results.map((r) => r.week));
  return TRB_PHASES.map(([label, a, b]) => { let n = 0; for (let w = a; w <= b; w++) if (done.has(w)) n++; return { label, done: n, total: b - a + 1 }; });
}

export function trbShareText(d: TrbInput) {
  const n = d.results.length; const avg = n ? Math.round(d.results.reduce((s, r) => s + r.score, 0) / n) : null;
  return [`⚓ e-TRB progress — ${d.name}`, `${d.track === "deck" ? "Deck" : "Engine"} cadet${d.vessel ? ` · ${d.vessel}` : ""}${d.company ? ` · ${d.company}` : ""}`,
    `Completed ${n}/32 modules (${Math.round((n / 32) * 100)}%) · Avg score ${avg ?? "—"}%`,
    ...phaseStats(d.results).map((p) => `• ${p.label}: ${p.done}/${p.total}`), "Sent from SeaMinds Cadet Academy"].join("\n");
}

export async function buildTrbPdf(d: TrbInput, mode: TrbMode) {
  const { jsPDF } = await import("jspdf");
  const cur = CADET_CURRICULUM[d.track]; const doc = new jsPDF({ unit: "mm", format: "a4" }); let y = 16;
  const line = (t: string, size = 9, bold = false, color: [number, number, number] = [20, 20, 20]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    for (const l of doc.splitTextToSize(t, 180)) { if (y > 282) { doc.addPage(); y = 16; } doc.text(l, 15, y); y += size * 0.45; } };
  doc.setFillColor(13, 27, 42); doc.rect(0, 0, 210, 30, "F"); doc.setTextColor(212, 175, 55); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text(mode === "clearance" ? "PRE-JOINING INDUCTION CLEARANCE" : mode === "summary" ? "e-TRB PROGRESS RECORD (SUMMARY)" : "ELECTRONIC TRAINING RECORD BOOK (e-TRB)", 15, 14); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
  doc.text(`STCW ${d.track === "deck" ? "A-II/1" : "A-III/1"} · SeaMinds Cadet Academy · ${d.track === "deck" ? "Deck" : "Engine"} track · Generated ${new Date().toISOString().slice(0, 10)}`, 15, 22); y = 40;
  const res = new Map(d.results.map((r) => [r.week, r])); const n = d.results.length;
  const avg = n ? Math.round(d.results.reduce((s, r) => s + r.score, 0) / n) : null;
  line(`Cadet: ${d.name}`, 11, true); if (d.email || d.company) line(`Email: ${d.email || "—"}   ·   Company: ${d.company || "—"}`);
  line(`Vessel: ${d.vessel || "—"}${d.imo ? ` (IMO ${d.imo})` : ""}   ·   Shore start: ${d.shore_start || "—"}   ·   Joined: ${d.join_date || "—"}`);
  line(`Progress: ${n}/32 modules (${Math.round((n / 32) * 100)}%)   ·   Average test score: ${avg ?? "—"}%   ·   Current module: ${d.current_week}`, 9, true); y += 3;
  if (mode === "clearance") {
    const shore = [1, 2, 3, 4].map((w) => res.get(w)); const ok = shore.every((r) => r && r.score >= 60);
    line(ok ? "STATUS: CLEARED — all four pre-joining modules passed" : "STATUS: NOT YET CLEARED", 11, true, ok ? [20, 110, 50] : [180, 30, 30]); y += 2;
    shore.forEach((r, i) => line(`Module ${i + 1} · ${cur[i].t} — ${r ? `${r.score}% · ${String(r.completed_at).slice(0, 10)}` : "pending"}`, 9));
    y += 3; line("Covers: Maritime English & SMCP, safety culture & stop-work authority, ISM/PPE/permit-to-work, track basics, document & medical readiness, SOLAS safety familiarisation.", 8.5);
  } else if (mode === "summary") {
    for (const p of phaseStats(d.results)) line(`${p.label}: ${p.done}/${p.total} completed`, 9.5, true, [13, 27, 42]);
    y += 3; line("Completed modules", 10, true);
    for (const r of [...d.results].sort((a, b) => a.week - b.week)) {
      const ck = r.checklist || []; line(`M${r.week} ${cur[r.week - 1]?.t || ""} — ${r.score}% · tasks ${ck.filter(Boolean).length}/${ck.length} · ${String(r.completed_at).slice(0, 10)} · Officer: ${r.officer_name || "—"}`, 8, false, r.score < 60 ? [180, 30, 30] : [20, 20, 20]);
    }
    if (!n) line("No modules completed yet.", 8.5);
  } else for (let w = 1; w <= 32; w++) {
    const m = cur[w - 1]; const r = res.get(w); if (y > 262) { doc.addPage(); y = 16; }
    doc.setDrawColor(212, 175, 55); doc.line(15, y - 2, 195, y - 2); y += 2;
    line(`Module ${w} · ${stageLabel(w)} · ${m.t}`, 9.5, true, [13, 27, 42]);
    line(`Equipment: ${m.eq.join(", ")}   ·   Ref: ${m.ref}`, 8, false, [90, 90, 90]);
    if (r) { const ck = r.checklist || [];
      line(`Completed ${String(r.completed_at).slice(0, 10)} · Test ${r.correct ?? "—"}/${r.total ?? "—"} (${r.score}%)${r.attempts ? ` · Attempts ${r.attempts}` : ""} · Officer: ${r.officer_name || "______________"}`, 8.5, false, r.score < 60 ? [180, 30, 30] : [20, 110, 50]);
      m.chk.forEach((t, i) => line(`${ck[i] ? "[x]" : "[ ]"} ${t}`, 8));
    } else line("Pending — to be completed before sign-off", 8.5, false, [150, 110, 0]);
    y += 2;
  }
  y += 6; line("Verified by Master / Chief Engineer: ______________________   Signature & stamp: ______________   Date: __________", 9, true);
  line("Scores are graded by SeaMinds from the cadet's own answers. Practical checklist items are self-declared by the cadet and must be verified by the supervising officer.", 7.5, false, [100, 100, 100]);
  return { doc, file: `Cadet-eTRB-${mode}-${d.name.replace(/[^\w]+/g, "_")}.pdf` };
}
