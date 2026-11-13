// Manager Cadet Academy: separate cadet roster, enrolment, monitoring flags and Training Record Book PDF.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CADET_CURRICULUM, CADET_WEEKS, cadetFlag, stageLabel, type CadetTrack } from "@/lib/cadetCurriculum";

const GOLD = "#D4AF37", NAVY = "#0D1B2A", CARD = "#112240", BORDER = "rgba(212,175,55,0.3)", MUTED = "#94A3B8";
type Row = { id: string; email: string; name: string; track: CadetTrack; vessel: string | null; imo: string | null; registered: boolean; status: string;
  shore_start: string; join_date: string | null; current_week: number; done: number; avg_score: number | null; low_weeks: number; last_activity: string | null; overdue_days: number };
const FLAG: Record<string, [string, string]> = { overdue: ["🔴 Overdue", "#ef4444"], weak: ["🟡 Needs attention", "#f59e0b"], ok: ["🟢 On track", "#22c55e"], closed: ["⚪ Closed", MUTED] };
const inp: React.CSSProperties = { background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 10, color: "#fff", padding: "9px 10px", fontSize: 13, width: "100%" };
const rpc = (fn: string, args: Record<string, unknown> = {}) => supabase.rpc(fn as any, args as any);

export default function CadetAcademy({ company }: { company?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [f, setF] = useState({ email: "", name: "", track: "deck" as CadetTrack, vessel: "", imo: "", shore: new Date().toISOString().slice(0, 10), join: "" });
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState(""); const [flt, setFlt] = useState("all"); const [trk, setTrk] = useState("all");
  const load = useCallback(async () => { const { data, error } = await rpc("manager_cadet_roster"); if (error) { toast.error("Could not load cadets"); setRows([]); } else setRows((data as Row[]) || []); }, []);
  useEffect(() => { void load(); }, [load]);

  const enroll = async () => {
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return toast.error("Enter the cadet's email");
    setBusy(true);
    const { data, error } = await rpc("manager_enroll_cadet", { p_email: f.email, p_name: f.name, p_track: f.track, p_vessel: f.vessel || null, p_imo: f.imo || null, p_shore_start: f.shore || null, p_join_date: f.join || null });
    setBusy(false);
    const d = data as any;
    if (error || !d?.ok) return toast.error(d?.error === "NOT_MANAGER" ? "Manager profile required" : "Could not enrol cadet");
    const link = "https://seaminds.life/training?tab=cadet";
    const msg = `Hello ${f.name || "Cadet"},\n${company || "Our company"} has enrolled you in the SeaMinds Cadet Academy (${f.track === "deck" ? "Deck" : "Engine"}): 4 weeks shore induction + 28 weeks onboard, one short module and test each week.\nSign in with this email (${f.email.trim()}) and open: ${link}\nFree for cadets.`;
    try { await navigator.clipboard.writeText(msg); } catch { /* ignore */ }
    toast.success(d.registered ? "Cadet enrolled — invite text copied" : "Enrolled. They'll see it after signing up with this email — invite text copied");
    setF({ ...f, email: "", name: "" }); void load();
  };

  const list = useMemo(() => (rows || []).filter((r) => (trk === "all" || r.track === trk) && (flt === "all" || cadetFlag(r) === flt)
    && (!q || `${r.name} ${r.email} ${r.vessel || ""}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, flt, trk]);
  const counts = useMemo(() => { const c: Record<string, number> = { overdue: 0, weak: 0, ok: 0, closed: 0 }; (rows || []).forEach((r) => c[cadetFlag(r)]++); return c; }, [rows]);

  const remove = async (r: Row) => { if (!confirm(`Remove ${r.name} and all cadet records?`)) return; await rpc("manager_delete_cadet", { p_id: r.id }); void load(); };
  const setStatus = async (r: Row, status: string) => { await rpc("manager_update_cadet", { p_id: r.id, p_vessel: r.vessel, p_imo: r.imo, p_join_date: r.join_date, p_status: status }); void load(); };
  const setJoin = async (r: Row) => {
    const v = prompt("Vessel name", r.vessel || ""); if (v === null) return;
    const imo = prompt("IMO number (7 digits, optional)", r.imo || "") ?? r.imo;
    const jd = prompt("Joining date onboard (YYYY-MM-DD)", r.join_date || "") || null;
    await rpc("manager_update_cadet", { p_id: r.id, p_vessel: v, p_imo: imo, p_join_date: jd && /^\d{4}-\d{2}-\d{2}$/.test(jd) ? jd : null, p_status: r.status }); void load();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "rgba(212,175,55,0.07)", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14 }}>
        <p style={{ color: GOLD, fontSize: 13, fontWeight: 800, marginBottom: 5 }}>⚓ Cadet Academy</p>
        <p style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.55 }}>Separate from crew interviews. 1 month shore induction (English, safety, basics, readiness) then 7 months onboard: one equipment module, practical checklist and short test every week. Cadets get a daily reminder until the week is done. Download the Training Record Book any time.</p>
      </div>

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, display: "grid", gap: 8 }}>
        <p style={{ color: GOLD, fontWeight: 800, fontSize: 13 }}>Enrol a cadet</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input style={inp} placeholder="Cadet email *" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <input style={inp} placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <select style={inp} value={f.track} onChange={(e) => setF({ ...f, track: e.target.value as CadetTrack })}><option value="deck">Deck Cadet</option><option value="engine">Engine Cadet</option></select>
          <input style={inp} placeholder="Vessel (optional)" value={f.vessel} onChange={(e) => setF({ ...f, vessel: e.target.value })} />
          <input style={inp} placeholder="IMO (optional)" value={f.imo} onChange={(e) => setF({ ...f, imo: e.target.value.replace(/\D/g, "").slice(0, 7) })} />
          <div />
          <label style={{ color: MUTED, fontSize: 11 }}>📅 Shore induction starts<input type="date" style={inp} value={f.shore} onChange={(e) => setF({ ...f, shore: e.target.value })} /></label>
          <label style={{ color: MUTED, fontSize: 11 }}>🚢 Joining ship (onboard weeks start)<input type="date" style={inp} value={f.join} onChange={(e) => setF({ ...f, join: e.target.value })} /></label>
        </div>
        <button disabled={busy} onClick={enroll} style={{ background: GOLD, color: NAVY, fontWeight: 800, borderRadius: 12, padding: "11px 0", border: "none", cursor: "pointer" }}>{busy ? "Enrolling…" : "Enrol & copy invite text"}</button>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["all", "overdue", "weak", "ok", "closed"] as const).map((k) => (
          <button key={k} onClick={() => setFlt(k)} style={{ fontSize: 12, fontWeight: 700, borderRadius: 999, padding: "6px 11px", border: `1px solid ${GOLD}`, background: flt === k ? GOLD : "transparent", color: flt === k ? NAVY : GOLD, cursor: "pointer" }}>
            {k === "all" ? `All ${rows?.length ?? 0}` : `${FLAG[k][0]} ${counts[k]}`}</button>))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input style={inp} placeholder="Search name, email or vessel" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={{ ...inp, width: 130 }} value={trk} onChange={(e) => setTrk(e.target.value)}><option value="all">All tracks</option><option value="deck">Deck</option><option value="engine">Engine</option></select>
      </div>

      {rows === null ? <p style={{ color: MUTED }}>Loading…</p> : list.length === 0 ? <p style={{ color: MUTED, fontSize: 13 }}>No cadets yet. Enrol your first cadet above.</p> : list.map((r) => {
        const fl = FLAG[cadetFlag(r)];
        const pct = Math.round((r.done / CADET_WEEKS) * 100);
        return (
          <div key={r.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
              <div>
                <p style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>{r.name} <span style={{ color: MUTED, fontWeight: 500, fontSize: 12 }}>· {r.track === "deck" ? "Deck" : "Engine"} Cadet</span></p>
                <p style={{ color: MUTED, fontSize: 11.5 }}>{r.email}{r.registered ? "" : " · not signed up yet"}{r.vessel ? ` · 🚢 ${r.vessel}` : ""}{r.imo ? ` (IMO ${r.imo})` : ""}</p>
              </div>
              <span style={{ color: fl[1], fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>{fl[0]}</span>
            </div>
            <div style={{ height: 6, background: NAVY, borderRadius: 4, margin: "10px 0 6px" }}><div style={{ width: `${pct}%`, height: 6, background: GOLD, borderRadius: 4 }} /></div>
            <p style={{ color: "#cbd5e1", fontSize: 12 }}>Week {r.current_week}/32 · {stageLabel(r.current_week)} · {r.done} done · Avg {r.avg_score ?? "—"}%{r.overdue_days > 0 ? ` · ${r.overdue_days} days late` : ""}</p>
            <p style={{ color: MUTED, fontSize: 11 }}>Shore from {r.shore_start}{r.join_date ? ` · joins ${r.join_date}` : " · joining date not set"}{r.last_activity ? ` · last activity ${r.last_activity.slice(0, 10)}` : ""}</p>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={() => void exportTrb(r.id)} style={btn(true)}>📄 Record Book PDF</button>
              <button onClick={() => void setJoin(r)} style={btn()}>🚢 Vessel / join date</button>
              {r.status === "active" ? <button onClick={() => void setStatus(r, "withdrawn")} style={btn()}>Pause</button> : <button onClick={() => void setStatus(r, "active")} style={btn()}>Re-activate</button>}
              <button onClick={() => void remove(r)} style={{ ...btn(), color: "#ef4444", borderColor: "#ef4444" }}>Remove</button>
            </div>
          </div>);
      })}
    </div>
  );
}
const btn = (primary = false): React.CSSProperties => ({ fontSize: 12, fontWeight: 800, borderRadius: 10, padding: "7px 11px", cursor: "pointer", border: `1px solid ${GOLD}`, background: primary ? GOLD : "transparent", color: primary ? NAVY : GOLD });

/** Builds an A4 Cadet Training Record Book from server records. */
export async function exportTrb(id: string) {
  const { data, error } = await rpc("manager_cadet_dossier", { p_id: id });
  const d = data as any;
  if (error || !d?.ok) { toast.error("Could not load record"); return; }
  const { jsPDF } = await import("jspdf");
  const c = d.cadet; const track = c.track as CadetTrack; const cur = CADET_CURRICULUM[track];
  const doc = new jsPDF({ unit: "mm", format: "a4" }); let y = 16;
  const line = (t: string, size = 9, bold = false, color: [number, number, number] = [20, 20, 20]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    for (const l of doc.splitTextToSize(t, 180)) { if (y > 282) { doc.addPage(); y = 16; } doc.text(l, 15, y); y += size * 0.45; } };
  doc.setFillColor(13, 27, 42); doc.rect(0, 0, 210, 30, "F"); doc.setTextColor(212, 175, 55); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text("CADET TRAINING RECORD BOOK", 15, 14); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
  doc.text(`SeaMinds Cadet Academy · ${track === "deck" ? "Deck" : "Engine"} track · Generated ${new Date().toISOString().slice(0, 10)}`, 15, 22); y = 40;
  const results = (d.weeks as any[]).filter((w) => w.result); const avg = results.length ? Math.round(results.reduce((s, w) => s + w.result.score, 0) / results.length) : null;
  line(`Cadet: ${c.display_name}`, 11, true); line(`Email: ${c.email}   ·   Company: ${c.company || "—"}`);
  line(`Vessel: ${c.vessel || "—"}${c.imo ? ` (IMO ${c.imo})` : ""}   ·   Shore start: ${c.shore_start}   ·   Joined: ${c.join_date || "—"}`);
  line(`Progress: ${results.length}/32 weeks completed   ·   Average test score: ${avg ?? "—"}%   ·   Current week: ${c.current_week}`, 9, true); y += 3;
  for (const w of d.weeks as any[]) {
    const m = cur[w.week - 1]; const r = w.result;
    if (y > 262) { doc.addPage(); y = 16; }
    doc.setDrawColor(212, 175, 55); doc.line(15, y - 2, 195, y - 2); y += 2;
    line(`Week ${w.week} · ${stageLabel(w.week)} · ${m.t}`, 9.5, true, [13, 27, 42]);
    line(`Equipment: ${m.eq.join(", ")}   ·   Ref: ${m.ref}`, 8, false, [90, 90, 90]);
    if (r) {
      const ck = (r.checklist as boolean[]) || [];
      line(`Completed ${String(r.completed_at).slice(0, 10)} · Test ${r.correct}/${r.total} (${r.score}%) · Attempts ${r.attempts} · Officer: ${r.officer_name || "______________"}`, 8.5, false, r.score < 60 ? [180, 30, 30] : [20, 110, 50]);
      m.chk.forEach((t, i) => line(`${ck[i] ? "[x]" : "[ ]"} ${t}`, 8));
    } else line(`Not completed · due ${w.due}`, 8.5, false, [150, 110, 0]);
    y += 2;
  }
  y += 6; line("Verified by Master / Chief Engineer: ______________________   Signature & stamp: ______________   Date: __________", 9, true);
  line("Scores are graded by SeaMinds from the cadet's own answers. Practical checklist items are self-declared by the cadet and must be verified by the supervising officer.", 7.5, false, [100, 100, 100]);
  doc.save(`Cadet-TRB-${String(c.display_name).replace(/[^\w]+/g, "_")}.pdf`);
}
