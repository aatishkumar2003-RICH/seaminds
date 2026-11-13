// Manager Cadet Academy: separate cadet roster, enrolment, monitoring flags and Training Record Book PDF.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { readXlsxTable, parseCsv } from "@/lib/companyCrewImport";
import { readDocumentText } from "@/lib/brainAttachments";
import { parseCadetTable, parseCadetText, cadetInviteText, type CadetBulkRow } from "@/lib/cadetBulk";
import { CADET_CURRICULUM, CADET_WEEKS, cadetFlag, stageLabel, type CadetTrack } from "@/lib/cadetCurriculum";

const GOLD = "#D4AF37", NAVY = "#0D1B2A", CARD = "#112240", BORDER = "rgba(212,175,55,0.3)", MUTED = "#94A3B8";
type Row = { id: string; email: string; name: string; track: CadetTrack; vessel: string | null; imo: string | null; registered: boolean; status: string;
  shore_start: string; join_date: string | null; current_week: number; done: number; avg_score: number | null; low_weeks: number; last_activity: string | null; overdue_days: number };
const FLAG: Record<string, [string, string]> = { overdue: ["🔴 Overdue", "#ef4444"], weak: ["🟡 Needs attention", "#f59e0b"], ok: ["🟢 On track", "#22c55e"], closed: ["⚪ Closed", MUTED] };
const inp: React.CSSProperties = { background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 10, color: "#fff", padding: "9px 10px", fontSize: 13, width: "100%" };
const sendInvite = async (email: string, name: string, track: CadetTrack, company?: string) => {
  const { data, error } = await supabase.functions.invoke("send-training-invite", { body: { email, message: cadetInviteText(name, company || "", track, email) } });
  return !error && (data as any)?.ok === true;
};
const rpc = (fn: string, args: Record<string, unknown> = {}) => supabase.rpc(fn as any, args as any);

export default function CadetAcademy({ company }: { company?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [f, setF] = useState({ email: "", name: "", track: "deck" as CadetTrack, vessel: "", imo: "", shore: new Date().toISOString().slice(0, 10), join: "" });
  const [busy, setBusy] = useState(false); const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState(""); const [flt, setFlt] = useState("all"); const [trk, setTrk] = useState("all");
  const load = useCallback(async () => { const { data, error } = await rpc("manager_cadet_roster"); if (error) { toast.error("Could not load cadets"); setRows([]); } else setRows((data as Row[]) || []); }, []);
  useEffect(() => { void load(); const id = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30000); return () => clearInterval(id); }, [load]);

  const enroll = async () => {
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return toast.error("Enter the cadet's email");
    setBusy(true);
    const { data, error } = await rpc("manager_enroll_cadet", { p_email: f.email, p_name: f.name, p_track: f.track, p_vessel: f.vessel || null, p_imo: f.imo || null, p_shore_start: f.shore || null, p_join_date: f.join || null });
    setBusy(false);
    const d = data as any;
    if (error || !d?.ok) return toast.error(d?.error === "NOT_MANAGER" ? "Manager profile required" : "Could not enrol cadet");
    const email = f.email.trim().toLowerCase();
    try { await navigator.clipboard.writeText(cadetInviteText(f.name, company || "", f.track, email)); } catch { /* ignore */ }
    const sent = await sendInvite(email, f.name, f.track, company);
    toast[sent ? "success" : "warning"](sent ? `Enrolled — invitation emailed to ${email} (text also copied for WhatsApp)` : "Enrolled, but the email could not be sent — paste the copied text into WhatsApp/Zalo");
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
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 120 }}>
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
        <p style={{ color: MUTED, fontSize: 11 }}>The cadet receives an email invitation immediately. The same text is copied for WhatsApp / Zalo.</p>
        <button disabled={busy} onClick={enroll} style={{ background: GOLD, color: NAVY, fontWeight: 800, borderRadius: 12, padding: "11px 0", border: "none", cursor: "pointer" }}>{busy ? "Enrolling…" : "Enrol & email invitation"}</button>
      </div>

      <BulkEnrol company={company} onDone={load} />
      {rows && rows.length > 0 && <CohortNow rows={rows} />}

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
            {(() => { const m = CADET_CURRICULUM[r.track][Math.min(32, r.current_week) - 1]; return m ? (
              <div style={{ background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 10px", margin: "6px 0" }}>
                <p style={{ color: GOLD, fontSize: 11, fontWeight: 800 }}>📘 Learning now · Week {m.week}: {m.t}</p>
                <p style={{ color: "#cbd5e1", fontSize: 11.5, marginTop: 2 }}>🔧 {m.eq.join(" · ")}</p>
              </div>) : null; })()}
            <p style={{ color: MUTED, fontSize: 11 }}>Shore from {r.shore_start}{r.join_date ? ` · joins ${r.join_date}` : " · joining date not set"}{r.last_activity ? ` · last activity ${r.last_activity.slice(0, 10)}` : ""}</p>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={() => void exportTrb(r.id)} style={btn(true)}>📄 Record Book PDF</button>
              <button onClick={() => setOpenId(openId === r.id ? null : r.id)} style={btn()}>{openId === r.id ? "Hide progress" : "👁 Live progress"}</button>
              <button onClick={async () => { const ok = await sendInvite(r.email, r.name, r.track, company); toast[ok ? "success" : "error"](ok ? `Invitation re-sent to ${r.email}` : "Email failed — use WhatsApp"); }} style={btn()}>✉️ Resend email</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(cadetInviteText(r.name, company || "", r.track, r.email))}`} target="_blank" rel="noopener noreferrer" style={{ ...btn(), textDecoration: "none" }}>💬 WhatsApp</a>
              <button onClick={() => void setJoin(r)} style={btn()}>🚢 Vessel / join date</button>
              {r.status === "active" ? <button onClick={() => void setStatus(r, "withdrawn")} style={btn()}>Pause</button> : <button onClick={() => void setStatus(r, "active")} style={btn()}>Re-activate</button>}
              <button onClick={() => void remove(r)} style={{ ...btn(), color: "#ef4444", borderColor: "#ef4444" }}>Remove</button>
            </div>
            {openId === r.id && <CadetLive id={r.id} track={r.track} />}
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

/** Cohort snapshot: what the group is learning this week and who finished it. */
function CohortNow({ rows }: { rows: Row[] }) {
  const active = rows.filter((r) => r.status === "active");
  const groups = new Map<string, { title: string; n: number; done: number }>();
  for (const r of active) {
    const m = CADET_CURRICULUM[r.track][Math.min(32, r.current_week) - 1]; if (!m) continue;
    const k = `${r.track}-${m.week}`; const g = groups.get(k) || { title: `${r.track === "deck" ? "Deck" : "Engine"} · Week ${m.week}: ${m.t}`, n: 0, done: 0 };
    g.n++; if (r.done >= r.current_week) g.done++; groups.set(k, g);
  }
  const recent = rows.filter((r) => r.last_activity && Date.now() - new Date(r.last_activity).getTime() < 86400000).length;
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14 }}>
      <p style={{ color: GOLD, fontWeight: 800, fontSize: 13 }}>📡 Cohort live · {active.length} active · {recent} completed a week in last 24h</p>
      {[...groups.values()].sort((a, b) => b.n - a.n).slice(0, 6).map((g) => (
        <div key={g.title} style={{ marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#cbd5e1", gap: 8 }}><span>{g.title}</span><span style={{ whiteSpace: "nowrap" }}>{g.done}/{g.n} cadets</span></div>
          <div style={{ height: 5, background: NAVY, borderRadius: 4, marginTop: 3 }}><div style={{ width: `${g.n ? (g.done / g.n) * 100 : 0}%`, height: 5, background: "#22c55e", borderRadius: 4 }} /></div>
        </div>))}
      <p style={{ color: MUTED, fontSize: 10.5, marginTop: 8 }}>Refreshes every 30 seconds.</p>
    </div>);
}

/** Per-cadet live record: each week's test, checklist and supervising officer. */
function CadetLive({ id, track }: { id: string; track: CadetTrack }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { void rpc("manager_cadet_dossier", { p_id: id }).then(({ data }) => setD(data)); }, [id]);
  if (!d) return <p style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>Loading progress…</p>;
  if (!d.ok) return <p style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>Could not load progress.</p>;
  const cw = d.cadet.current_week as number;
  const weeks = (d.weeks as any[]).filter((w) => w.result || w.week <= cw);
  return (
    <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
      {weeks.map((w) => { const m = CADET_CURRICULUM[track][w.week - 1]; const r = w.result; const ck: boolean[] = r?.checklist || [];
        return (
          <div key={w.week} style={{ background: NAVY, border: `1px solid ${r ? (r.score >= 60 ? "#22c55e55" : "#f59e0b55") : BORDER}`, borderRadius: 10, padding: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 12 }}>
              <b style={{ color: "#fff" }}>Week {w.week}: {m.t}</b>
              <span style={{ color: r ? (r.score >= 60 ? "#22c55e" : "#f59e0b") : MUTED, whiteSpace: "nowrap", fontWeight: 800 }}>{r ? `${r.score}% · ${r.attempts} try` : `due ${w.due}`}</span>
            </div>
            {m.chk.map((t, i) => <p key={i} style={{ color: ck[i] ? "#cbd5e1" : MUTED, fontSize: 11, marginTop: 2 }}>{ck[i] ? "✅" : "⬜"} {t}</p>)}
            {r && <p style={{ color: MUTED, fontSize: 10.5, marginTop: 3 }}>Completed {String(r.completed_at).slice(0, 10)} · Officer: {r.officer_name || "not given"}</p>}
          </div>); })}
    </div>);
}

/** Bulk enrol from Excel/CSV/Word/PDF or pasted list; emails every cadet. */
function BulkEnrol({ company, onDone }: { company?: string; onDone: () => void }) {
  const [open, setOpen] = useState(false); const [text, setText] = useState(""); const [track, setTrack] = useState<CadetTrack>("deck");
  const [rows, setRows] = useState<CadetBulkRow[]>([]); const [shore, setShore] = useState(new Date().toISOString().slice(0, 10));
  const [email, setEmail] = useState(true); const [prog, setProg] = useState("");
  const readFile = async (file: File) => {
    try {
      if (/\.(xlsx|xls)$/i.test(file.name)) setRows(parseCadetTable(await readXlsxTable(file), track));
      else if (/\.csv$/i.test(file.name)) setRows(parseCadetTable(parseCsv(await file.text()), track));
      else { const t = /\.(txt|md)$/i.test(file.name) ? await file.text() : (await readDocumentText(file)).text; setText(t); setRows(parseCadetText(t, track)); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not read file"); }
  };
  const run = async () => {
    let ok = 0, mailed = 0, failed = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; setProg(`Enrolling ${i + 1} / ${rows.length}…`);
      const { data, error } = await rpc("manager_enroll_cadet", { p_email: r.email, p_name: r.name, p_track: r.track, p_vessel: r.vessel || null, p_imo: null, p_shore_start: shore || null, p_join_date: null });
      if (error || !(data as any)?.ok) { failed++; continue; } ok++;
      if (email && await sendInvite(r.email, r.name, r.track, company)) mailed++;
    }
    setProg(""); toast.success(`${ok} cadets enrolled${email ? ` · ${mailed} emails sent` : ""}${failed ? ` · ${failed} failed` : ""}`);
    setRows([]); setText(""); setOpen(false); onDone();
  };
  if (!open) return <button onClick={() => setOpen(true)} style={{ ...btn(), padding: "11px 0" }}>📥 Bulk enrol cadets (Excel, CSV, Word, PDF or paste)</button>;
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><p style={{ color: GOLD, fontWeight: 800, fontSize: 13 }}>📥 Bulk enrol cadets</p><button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer" }}>Close</button></div>
      <p style={{ color: MUTED, fontSize: 11.5 }}>One cadet per row: email (required), name, Deck/Engine, vessel. Rows without "Engine" use the default track below.</p>
      <input type="file" accept=".xlsx,.csv,.docx,.pdf,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ""; }} style={{ color: MUTED, fontSize: 12 }} />
      <textarea style={{ ...inp, minHeight: 90 }} placeholder={"cadet1@gmail.com, Nguyen Van A, Engine Cadet, MV Pacific\ncadet2@gmail.com, Tran Van B, Deck Cadet"} value={text} onChange={(e) => { setText(e.target.value); setRows(parseCadetText(e.target.value, track)); }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ color: MUTED, fontSize: 11 }}>Default track<select style={inp} value={track} onChange={(e) => { const t = e.target.value as CadetTrack; setTrack(t); if (text) setRows(parseCadetText(text, t)); }}><option value="deck">Deck Cadet</option><option value="engine">Engine Cadet</option></select></label>
        <label style={{ color: MUTED, fontSize: 11 }}>📅 Shore induction starts<input type="date" style={inp} value={shore} onChange={(e) => setShore(e.target.value)} /></label>
      </div>
      <label style={{ color: "#cbd5e1", fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Email each cadet their invitation</label>
      {rows.length > 0 && (
        <div style={{ maxHeight: 220, overflowY: "auto", border: `1px solid ${BORDER}`, borderRadius: 10 }}>
          {rows.map((r, i) => (
            <div key={r.email} style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 8px", borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: "#cbd5e1" }}>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{r.name || "—"} · {r.email}{r.vessel ? ` · ${r.vessel}` : ""}</span>
              <select value={r.track} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, track: e.target.value as CadetTrack } : x))} style={{ ...inp, width: 90, padding: "3px 4px", fontSize: 11 }}><option value="deck">Deck</option><option value="engine">Engine</option></select>
              <button onClick={() => setRows(rows.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button>
            </div>))}
        </div>)}
      <button disabled={!rows.length || !!prog} onClick={() => void run()} style={{ background: GOLD, color: NAVY, fontWeight: 800, borderRadius: 12, padding: "11px 0", border: "none", cursor: "pointer", opacity: rows.length ? 1 : 0.5 }}>
        {prog || `Enrol ${rows.length} cadets`}</button>
    </div>);
}
