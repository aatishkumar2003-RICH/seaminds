import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, Loader2, ChevronLeft, ChevronRight, Clock, ShieldAlert } from "lucide-react";

const GOLD = "#D4AF37", NAVY = "#0D1B2A", CARD = "#112240", BORDER = "#1e3a5f";
const PAGE = 25;
const FILTERS = [["all", "All"], ["completed", "🟢 Completed"], ["in_progress", "🟡 In progress"], ["invited", "⚪ Not started"], ["flags", "🔴 Red flags"], ["shortlisted", "⭐ Shortlisted"]] as const;
const SORTS = [["score", "Top score"], ["recent", "Most recent"], ["fastest", "Fastest"]] as const;

export type CandidateRow = Record<string, any> & { invite_id: string; name: string; status: string };
const n = (v: any) => (v === null || v === undefined ? "—" : Number(v).toFixed(2));
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—");
export const progressLabel = (r: any) =>
  r.status === "completed" ? `Completed${r.minutes != null ? ` in ${r.minutes} min` : ""}`
  : r.status === "in_progress" ? `In progress${r.question_total ? ` · Q${(r.question_index ?? 0) + 1}/${r.question_total}` : ""}`
  : r.signed_in ? "Signed in, not started" : "Invited, not opened";

/** Paged, searchable candidate list for one interview campaign + click-through dossier. Scales to thousands. */
export default function CandidateBoard({ campaignId, renderActions }: { campaignId: string; renderActions: (r: CandidateRow) => ReactNode }) {
  const [q, setQ] = useState(""); const [term, setTerm] = useState("");
  const [status, setStatus] = useState("all"); const [sort, setSort] = useState("score"); const [page, setPage] = useState(0);
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true);
  const [openRow, setOpenRow] = useState<CandidateRow | null>(null);
  useEffect(() => { const t = setTimeout(() => { setTerm(q.trim()); setPage(0); }, 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    let live = true; setLoading(true);
    supabase.rpc("campaign_candidates_v2" as any, { p_campaign_id: campaignId, p_search: term || null, p_status: status, p_sort: sort, p_limit: PAGE, p_offset: page * PAGE })
      .then(({ data: d }) => { if (live) { setData(d); setLoading(false); } });
    return () => { live = false; };
  }, [campaignId, term, status, sort, page]);
  const rows: CandidateRow[] = data?.rows || []; const total = data?.total ?? 0; const c = data?.counts || {};
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const chip = (on: boolean) => ({ padding: "5px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const, background: on ? GOLD : "transparent", color: on ? NAVY : GOLD, border: `1px solid ${on ? GOLD : "rgba(212,175,55,0.4)"}` });
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 10 }}>
        {[["Invited", c.all], ["Completed", c.completed], ["In progress", c.in_progress], ["Red flags", c.flags]].map(([l, v]) => (
          <div key={l as string} style={{ background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "7px 8px" }}>
            <p style={{ color: "#94a3b8", fontSize: 10 }}>{l}</p><p style={{ color: "#fff", fontWeight: 900, fontSize: 16 }}>{v ?? "—"}</p>
          </div>))}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "0 10px" }}>
        <Search size={14} color="#94a3b8" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, nationality, rank…" aria-label="Search candidates"
          style={{ flex: 1, background: "transparent", color: "#fff", border: "none", outline: "none", padding: "9px 0", fontSize: 13 }} />
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(0); }} aria-label="Sort" style={{ background: NAVY, color: GOLD, border: "none", fontSize: 12 }}>
          {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", margin: "8px 0", paddingBottom: 2 }}>
        {FILTERS.map(([k, l]) => <button key={k} style={chip(status === k)} onClick={() => { setStatus(k); setPage(0); }}>{l}{c[k] != null ? ` ${c[k]}` : ""}</button>)}
      </div>
      {loading ? <p style={{ color: "#64748b", fontSize: 12, display: "flex", gap: 6 }}><Loader2 size={14} className="animate-spin" /> Loading candidates…</p>
        : rows.length === 0 ? <p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>{term || status !== "all" ? "No candidates match." : "Nobody has opened this interview yet. Share the link on WhatsApp, Zalo or email."}</p>
        : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((r, i) => (
            <button key={r.invite_id} onClick={() => setOpenRow(r)} style={{ textAlign: "left", background: "rgba(255,255,255,0.03)", border: `1px solid ${r.red_flag_count > 0 ? "rgba(239,68,68,0.5)" : BORDER}`, borderRadius: 11, padding: "9px 11px", cursor: "pointer", display: "flex", gap: 9, alignItems: "center" }}>
              <span style={{ color: GOLD, fontWeight: 900, minWidth: 24, fontSize: 13 }}>{page * PAGE + i + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", color: "#fff", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}{r.nationality ? ` · ${r.nationality}` : ""}{r.rank ? ` · ${r.rank}` : ""}</span>
                <span style={{ display: "block", color: "#94a3b8", fontSize: 10.5, marginTop: 2 }}>{progressLabel(r)}{r.red_flag_count > 0 ? ` · ⚠ ${r.red_flag_count} flag${r.red_flag_count === 1 ? "" : "s"}` : ""}</span>
              </span>
              <span style={{ textAlign: "right" }}>
                <span style={{ display: "block", color: r.overall ? "#22c55e" : "#64748b", fontWeight: 900, fontSize: 16 }}>{r.overall ? n(r.overall) : "—"}</span>
                <span style={{ color: GOLD, fontSize: 10, fontWeight: 700 }}>View ›</span>
              </span>
            </button>))}
        </div>}
      {total > PAGE && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 9, color: "#94a3b8", fontSize: 12 }}>
          <button disabled={page === 0} onClick={() => setPage(page - 1)} style={{ ...chip(false), opacity: page === 0 ? 0.4 : 1 }}><ChevronLeft size={12} style={{ display: "inline" }} /> Prev</button>
          <span>Page {page + 1} of {pages} · {total} candidates</span>
          <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} style={{ ...chip(false), opacity: page + 1 >= pages ? 0.4 : 1 }}>Next <ChevronRight size={12} style={{ display: "inline" }} /></button>
        </div>)}
      <Sheet open={!!openRow} onOpenChange={(o) => !o && setOpenRow(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto" style={{ background: NAVY, borderColor: BORDER }}>
          {openRow && <Dossier row={openRow} actions={renderActions(openRow)} onBack={() => setOpenRow(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Dossier({ row, actions, onBack }: { row: CandidateRow; actions: ReactNode; onBack: () => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { supabase.rpc("manager_candidate_dossier" as any, { p_invite_id: row.invite_id }).then(({ data }) => setD(data || { ok: false })); }, [row.invite_id]);
  const s = d?.scores; const box = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12 } as const;
  const h = (t: string) => <p style={{ color: GOLD, fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{t}</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, color: "#fff" }}>
      <button onClick={onBack} style={{ color: GOLD, display: "flex", alignItems: "center", gap: 4, fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: 0 }}><ChevronLeft size={16} /> Back to candidates</button>
      <SheetHeader><SheetTitle style={{ color: "#fff", textAlign: "left" }}>{row.name}</SheetTitle></SheetHeader>
      {!d ? <p style={{ color: "#94a3b8", fontSize: 13 }}><Loader2 size={14} className="animate-spin inline" /> Loading…</p> : !d.ok ? <p style={{ color: "#ef4444" }}>Could not load this candidate.</p> : <>
        <p style={{ color: "#94a3b8", fontSize: 12 }}>{[d.rank, d.nationality, d.years_at_sea ? `${d.years_at_sea} yrs at sea` : null].filter(Boolean).join(" · ") || "Profile not completed yet"}</p>
        <div style={box}>
          {h("Interview progress")}
          <p style={{ fontSize: 13, fontWeight: 700 }}><Clock size={13} style={{ display: "inline", marginRight: 5 }} />{progressLabel({ ...row, ...d, question_index: d.progress?.question, question_total: d.progress?.total })}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8, fontSize: 11.5, color: "#94a3b8" }}>
            <span>Invited: <b style={{ color: "#fff" }}>{fmt(d.invited_at)}</b></span>
            <span>Started: <b style={{ color: "#fff" }}>{fmt(d.started_at)}</b></span>
            <span>Finished: <b style={{ color: "#fff" }}>{fmt(d.completed_at)}</b></span>
            <span>Time taken: <b style={{ color: "#fff" }}>{d.minutes != null ? `${d.minutes} min` : "—"}</b></span>
            {d.progress?.last_saved_at && <span>Last active: <b style={{ color: "#fff" }}>{fmt(d.progress.last_saved_at)}</b></span>}
            {d.progress?.resumed ? <span>Resumed: <b style={{ color: "#fff" }}>{d.progress.resumed}×</b></span> : null}
          </div>
        </div>
        {s && <div style={box}>
          {h("Assessment score")}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><span style={{ fontSize: 30, fontWeight: 900, color: "#22c55e" }}>{n(s.overall)}</span><span style={{ color: "#94a3b8", fontSize: 12 }}>/ 5.00 {s.band ? `· ${s.band}` : ""}</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6, marginTop: 8 }}>
            {[["Technical", s.technical], ["Judgment", s.judgment], ["Maritime English", s.english], ["Behaviour & safety", s.behavioural], ["Experience", s.experience]].map(([l, v]) => (
              <div key={l} style={{ background: NAVY, borderRadius: 8, padding: "6px 8px" }}><p style={{ color: "#94a3b8", fontSize: 10.5 }}>{l}</p><p style={{ fontWeight: 800 }}>{n(v)}</p></div>))}
          </div>
          <p style={{ color: s.tier === "CV_VERIFIED" ? "#22c55e" : GOLD, fontSize: 11, marginTop: 8, fontWeight: 700 }}>{s.tier === "CV_VERIFIED" ? "🟢 CV-Based score (CV evidence, not independently verified)" : "🟡 Sea Profile score"}{s.round === 2 ? " · Round 2" : ""}</p>
          {s.recommendation && <p style={{ fontSize: 12, marginTop: 6, color: "#cbd5e1" }}>{s.recommendation}</p>}
        </div>}
        {d.red_flags?.length > 0 && <div style={{ ...box, borderColor: "rgba(239,68,68,0.5)" }}>
          {h("Safety red flags")}
          {d.red_flags.map((f: any, i: number) => <p key={i} style={{ fontSize: 12, marginBottom: 4 }}><ShieldAlert size={12} style={{ display: "inline", color: "#ef4444", marginRight: 4 }} /><b>{String(f.category || "Flag").replace(/_/g, " ")}</b>{f.detail ? ` — ${f.detail}` : ""}</p>)}
        </div>}
        <div style={box}>
          {h("CV — sea service & certificates")}
          {!d.approved ? <p style={{ fontSize: 12, color: "#94a3b8" }}>CV details open after SeaMinds approves your company account.</p>
            : !d.sea_service.length && !d.certificates.length ? <p style={{ fontSize: 12, color: "#94a3b8" }}>{d.signed_in ? "This candidate used Quick Profile — no CV uploaded yet. Use “Request CV & Round 2”." : "Candidate has not signed in yet."}</p>
            : <>
              {d.sea_service.slice(0, 15).map((v: any, i: number) => (
                <div key={i} style={{ borderBottom: `1px solid ${BORDER}`, padding: "5px 0", fontSize: 12 }}>
                  <b>{v.rank || v.position || "—"}</b> · {v.vessel_name || v.vessel || "Vessel"} {v.vessel_type ? `(${v.vessel_type})` : ""}
                  <span style={{ color: "#94a3b8", display: "block", fontSize: 11 }}>{[v.company || v.manager, v.dwt || v.grt ? `DWT/GRT ${v.dwt || v.grt}` : null, v.engine || v.engine_type, [v.sign_on || v.from, v.sign_off || v.to].filter(Boolean).join(" → ")].filter(Boolean).join(" · ")}</span>
                </div>))}
              {d.certificates.length > 0 && <p style={{ fontSize: 11.5, marginTop: 8, color: "#cbd5e1" }}><b style={{ color: GOLD }}>Certificates:</b> {d.certificates.slice(0, 30).map((c: any) => c?.name || c?.title || c?.type || (typeof c === "string" ? c : "")).filter(Boolean).join(", ")}</p>}
            </>}
          {d.approved && (d.email || d.whatsapp) && <p style={{ fontSize: 11.5, marginTop: 8, color: "#94a3b8" }}>{[d.email, d.whatsapp].filter(Boolean).join(" · ")}</p>}
        </div>
        <div style={box}>{h("Actions")}{actions}</div>
      </>}
    </div>
  );
}
