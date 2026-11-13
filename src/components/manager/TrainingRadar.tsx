import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, X } from "lucide-react";
import { dueStatus, rangeFor, type RangeKey } from "@/lib/targetDate";

const GOLD = "#D4AF37", NAVY = "#0D1B2A", CARD = "#112240", BORDER = "#1e3a5f";
type Row = { crew_id: string; name: string; rank: string | null; email: string | null; whatsapp: string | null; eng_attempts: number; eng_24h: number; eng_avg: number | null; eng_best: number | null; eng_last: string | null; eng_scenario: string | null; modules_done: number; modules_total: number; interviews: number; last_active: string | null; vessel?: string | null; target_date?: string | null };

export const ago = (iso: string | null, now = Date.now()) => {
  if (!iso) return "No activity yet";
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 2) return "Active now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};
export const englishLevel = (s: number | null) => s == null ? "—" : s >= 85 ? "Fluent" : s >= 70 ? "Operational" : s >= 50 ? "Developing" : "Needs support";
const scen = (s: string | null) => (s || "").replace(/^(eng|deck|bridge|safe|psc)-/, "").replace(/-/g, " ");

export default function TrainingRadar() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0); const [q, setQ] = useState(""); const [off, setOff] = useState(0);
  const [rank, setRank] = useState(""); const [status, setStatus] = useState("all"); const [ranks, setRanks] = useState<string[]>([]);
  const [vessel, setVessel] = useState(""); const [vessels, setVessels] = useState<string[]>([]);
  const [range, setRange] = useState<RangeKey>("any"); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [open, setOpen] = useState<Row | null>(null); const [stamp, setStamp] = useState(Date.now());
  const qRef = useRef(q); qRef.current = q;
  const load = useCallback(async () => {
    const { data } = await supabase.rpc("manager_training_radar" as any, { p_search: qRef.current.trim(), p_offset: off, p_rank: rank, p_status: status, p_vessel: vessel, p_from: rangeFor(range, from, to).from, p_to: rangeFor(range, from, to).to });
    const d = data as any;
    if (d?.ok) { setRows(d.rows); setTotal(d.total); setRanks(d.ranks || []); setVessels(d.vessels || []); } else setRows([]);
    setStamp(Date.now());
  }, [off, rank, status, vessel, range, from, to]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 20000);
    return () => clearInterval(id);
  }, [load]);
  const live = (rows || []).filter((r) => r.last_active && Date.now() - new Date(r.last_active).getTime() < 15 * 60000).length;
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <p style={{ color: GOLD, fontSize: 14, fontWeight: 800, flex: 1 }}>📡 Live training radar</p>
        <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 700 }}>● {live} active now</span>
        <button onClick={() => void load()} aria-label="Refresh" style={{ background: "none", border: "none", color: GOLD, cursor: "pointer" }}><RefreshCw size={14} /></button>
      </div>
      <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 3 }}>Crew appear here once they open your training link while signed in. Updates every 20 seconds · last {new Date(stamp).toLocaleTimeString()}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
      <input value={q} onChange={(e) => { setQ(e.target.value); setOff(0); }} placeholder={`Search ${total} crew by name or email`}
        style={{ flex: 1, minWidth: 180, background: NAVY, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 9, padding: 8, fontSize: 12 }} />
        <select value={rank} onChange={(e) => { setRank(e.target.value); setOff(0); }} aria-label="Filter by rank" style={{ minWidth: 140, background: NAVY, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 9, padding: 8, fontSize: 12 }}>
          <option value="">All ranks</option>{ranks.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={vessel} onChange={(e) => { setVessel(e.target.value); setOff(0); }} aria-label="Filter by vessel" style={{ minWidth: 130, background: NAVY, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 9, padding: 8, fontSize: 12 }}>
          <option value="">All vessels</option>{vessels.map((v) => <option key={v} value={v}>{v}</option>)}<option value="__none">No vessel recorded</option>
        </select>
        <select value={range} onChange={(e) => { setRange(e.target.value as RangeKey); setOff(0); }} aria-label="Practice date" style={{ minWidth: 120, background: NAVY, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 9, padding: 8, fontSize: 12 }}>
          <option value="any">Practised any time</option><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">Last 30 days</option><option value="custom">Pick dates…</option>
        </select>
        {range === "custom" && <><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setOff(0); }} aria-label="From date" style={{ background: NAVY, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 9, padding: 7, fontSize: 12, colorScheme: "dark" }} /><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setOff(0); }} aria-label="To date" style={{ background: NAVY, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 9, padding: 7, fontSize: 12, colorScheme: "dark" }} /></>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {([["all", "All linked crew"], ["today", "● Active today"], ["complete", "✅ Training complete"], ["idle", "💤 Idle 7+ days"], ["overdue", "🔴 Past target date"]] as const).map(([k, l]) =>
          <button key={k} onClick={() => { setStatus(k); setOff(0); }} style={{ padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer", background: status === k ? GOLD : "transparent", color: status === k ? NAVY : GOLD, border: `1px solid ${status === k ? GOLD : "rgba(212,175,55,0.45)"}` }}>{l}</button>)}
      </div>
      {rows === null ? <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 10 }}><Loader2 size={13} className="inline animate-spin" /> Loading…</p>
        : rows.length === 0 ? <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 10 }}>No crew yet. Send a training invitation below — progress shows here as soon as they start.</p>
        : <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {rows.map((r) => {
            const hot = r.last_active && Date.now() - new Date(r.last_active).getTime() < 15 * 60000;
            return (
              <button key={r.crew_id} onClick={() => setOpen(r)} style={{ textAlign: "left", background: NAVY, border: `1px solid ${hot ? "#22c55e" : BORDER}`, borderRadius: 11, padding: 10, cursor: "pointer", color: "#fff" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontWeight: 800, fontSize: 13, flex: 1 }}>{r.name || "Crew"} <span style={{ color: "#94a3b8", fontWeight: 600 }}>· {r.rank || "—"}{r.vessel ? ` · 🚢 ${r.vessel}` : ""}</span></span>
                  <span style={{ fontSize: 11, color: hot ? "#22c55e" : "#94a3b8", fontWeight: 700 }}>{hot ? "● " : ""}{ago(r.last_active)}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, fontSize: 11 }}>
                  <span style={pill}>🎙️ English {r.eng_avg ?? "—"}{r.eng_avg != null ? "%" : ""} · {englishLevel(r.eng_avg)}</span>
                  <span style={pill}>{r.eng_attempts} voice drills{r.eng_24h ? ` (${r.eng_24h} today)` : ""}</span>
                  <span style={pill}>📚 {r.modules_done}/{r.modules_total} modules</span>
                  <span style={pill}>🧭 {r.interviews} AI interviews</span>
                  {(() => { const ds = dueStatus(r.target_date, r.modules_total > 0 && r.modules_done === r.modules_total); return ds ? <span style={{ ...pill, color: ds.color, borderColor: ds.color }}>{ds.label}</span> : null; })()}
                  {r.eng_scenario && <span style={{ ...pill, color: "#cbd5e1" }}>Last: {scen(r.eng_scenario)}</span>}
                  <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); const [first, ...rest] = (r.name || "").split(" "); window.dispatchEvent(new CustomEvent("training-pick-crew", { detail: { id: `c:${r.crew_id}`, first_name: first || "", last_name: rest.join(" "), rank: r.rank || "", email: r.email, whatsapp: r.whatsapp, vessel: null } })); }}
                    style={{ ...pill, background: GOLD, color: NAVY, marginLeft: "auto" }}>🎓 Send training</span>
                </div>
              </button>);
          })}
          {total > 25 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8" }}>
            <button disabled={off === 0} onClick={() => setOff(Math.max(0, off - 25))} style={pager}>‹ Prev</button>
            <span>{off + 1}–{Math.min(off + 25, total)} of {total}</span>
            <button disabled={off + 25 >= total} onClick={() => setOff(off + 25)} style={pager}>Next ›</button>
          </div>}
        </div>}
      {open && <Detail row={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
const pill = { border: "1px solid rgba(212,175,55,0.35)", color: GOLD, borderRadius: 999, padding: "2px 8px", fontWeight: 700 } as const;
const pager = { background: "none", border: `1px solid ${BORDER}`, color: GOLD, borderRadius: 8, padding: "4px 10px", cursor: "pointer" } as const;

function Detail({ row, onClose }: { row: Row; onClose: () => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    const go = async () => { const { data } = await supabase.rpc("manager_training_detail" as any, { p_crew: row.crew_id }); if (alive) setD(data); };
    void go(); const id = setInterval(go, 20000);
    return () => { alive = false; clearInterval(id); };
  }, [row.crew_id]);
  const [mq, setMq] = useState("");
  const eng: any[] = d?.english || [];
  const byScen = Object.values(eng.reduce((m: any, e: any) => { const k = e.scenario; m[k] ??= { s: k, n: 0, best: 0, first: e.score, last: e.score, at: e.at }; m[k].n++; m[k].best = Math.max(m[k].best, e.score); m[k].first = e.score; return m; }, {})) as any[];
  const curve = [...eng].reverse().slice(-40);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 70, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px,100%)", height: "100%", overflowY: "auto", background: NAVY, borderLeft: `1px solid ${BORDER}`, padding: 16, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <p style={{ flex: 1, fontWeight: 800, fontSize: 16 }}>{row.name} <span style={{ color: "#94a3b8", fontSize: 13 }}>· {row.rank}</span></p>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}><X /></button>
        </div>
        <p style={{ fontSize: 11.5, color: "#94a3b8" }}>{[row.email, row.whatsapp].filter(Boolean).join(" · ") || "Contact shown after company approval"} · {ago(row.last_active)} · refreshes every 20 s</p>
        {!d ? <p style={{ marginTop: 14, color: "#94a3b8" }}><Loader2 size={14} className="inline animate-spin" /> Loading records…</p> : !d.ok ? <p style={{ marginTop: 14 }}>Records not available.</p> : <>
          <h3 style={h3}>🎙️ Maritime English — learning curve ({eng.length} drills)</h3>
          {curve.length > 0 ? <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 70, background: CARD, borderRadius: 8, padding: 6 }}>
            {curve.map((e, i) => <div key={i} title={`${e.score}% · ${new Date(e.at).toLocaleString()}`} style={{ flex: 1, height: `${Math.max(4, e.score)}%`, background: e.score >= 70 ? "#22c55e" : e.score >= 50 ? GOLD : "#f59e0b", borderRadius: 2 }} />)}
          </div> : <p style={muted}>No English practice yet.</p>}
          {byScen.map((s) => <div key={s.s} style={line}><span style={{ flex: 1, textTransform: "capitalize" }}>{scen(s.s)}</span><span style={muted}>{s.n}× · first {s.first}% → best {s.best}% · {ago(s.at)}</span></div>)}

          <h3 style={h3}>📚 Training modules</h3>
          {(d.modules || []).length > 5 && <input value={mq} onChange={(e) => setMq(e.target.value)} placeholder="Search modules (e.g. fire, CO2, SIRE)" style={{ width: "100%", background: CARD, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 7, fontSize: 12, marginBottom: 6 }} />}
          {(d.modules || []).length === 0 ? <p style={muted}>No modules yet.</p> : d.modules.filter((m: any) => !mq || String(m.title || "").toLowerCase().includes(mq.toLowerCase())).map((m: any, i: number) =>
            <div key={i} style={line}><span style={{ flex: 1 }}>{m.status === "completed" ? "✅" : m.status === "opened" ? "⏳" : "•"} {m.title}</span>
              <span style={muted}>{m.quiz_total ? `${m.quiz_correct}/${m.quiz_total}` : ""} {m.completed_at ? new Date(m.completed_at).toLocaleDateString() : m.status}</span></div>)}

          <h3 style={h3}>🧭 AI interview practice</h3>
          {(d.interviews || []).length === 0 ? <p style={muted}>No AI interviews yet.</p> : d.interviews.map((s: any, i: number) => {
            const mins = s.completed_at ? Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000) : null;
            return <div key={i} style={line}><span style={{ flex: 1 }}>{s.rank}{s.target_rank ? ` → ${s.target_rank}` : ""} · {s.status} · {s.turns} answers{mins != null ? ` · ${mins} min` : ""}</span>
              <span style={muted}>{s.shared ? `${s.technical_pct ?? "—"}% ${s.verdict || ""}${s.safety_flags ? ` · ⚠️ ${s.safety_flags}` : ""}` : "Result private"} · {ago(s.updated_at)}</span></div>;
          })}
        </>}
      </div>
    </div>
  );
}
const h3 = { color: GOLD, fontSize: 13, fontWeight: 800, margin: "16px 0 6px" } as const;
const muted = { color: "#94a3b8", fontSize: 11.5 } as const;
const line = { display: "flex", gap: 8, fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${BORDER}` } as const;
