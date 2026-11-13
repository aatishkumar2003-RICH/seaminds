import { useCallback, useEffect, useState } from "react";
import { Search, X, Ship, List, MessageCircle, Mail, FileDown, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildResumePdf } from "@/lib/resumePdf";
import { shareZalo } from "@/lib/zaloShare";
import { ago, englishLevel } from "@/components/manager/TrainingRadar";
import FourPartScores from "@/components/interview/FourPartScores";

type Row = { key: string; record_id: string | null; crew_id: string | null; name: string; rank: string | null; nationality: string | null; vessel: string | null; status: string; sources: string[]; crew_unique_id: string | null; certs_total: number; certs_30: number; certs_90: number; certs_expired: number; sea_count: number; eng_avg: number | null; eng_last: string | null; mods_done: number; mods_total: number };
type Res = { total: number; counts: Record<string, number>; ranks?: string[]; vessels: { vessel: string; n: number }[]; rows: Row[] };

const PAGE = 25;
const FILTERS: [string, string][] = [["all", "All crew"], ["certs", "⚠️ Certs ≤30 days"], ["training", "🎓 Training pending"], ["pending", "✉️ Not yet accepted"], ["onboard", "🚢 Assigned to vessel"]];
const SRC: Record<string, string> = { company: "Company crew", training: "Training", joining: "Joining", interview: "🎙️ Interview invited", training_invite: "✉️ Training invited" };

/** One live roster for every crew source (company crew, training invites, confirmed joinings). Server-paged so 10,000 crew stay fast. */
export default function UnifiedCrewBoard({ compact = false }: { compact?: boolean }) {
  const [q, setQ] = useState(""); const [dq, setDq] = useState("");
  const [filter, setFilter] = useState("all"); const [vessel, setVessel] = useState(""); const [rank, setRank] = useState("");
  const [view, setView] = useState<"list" | "vessel">("list");
  const [page, setPage] = useState(0); const [res, setRes] = useState<Res | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(0); }, 300); return () => clearTimeout(t); }, [q]);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("manager_unified_crew" as any, { p_search: dq, p_filter: filter, p_vessel: vessel, p_offset: page * PAGE, p_limit: PAGE, p_rank: rank });
    const d = data as any;
    if (error || !d?.ok) { setRes({ total: 0, counts: {}, vessels: [], rows: [] }); return; }
    setRes(d);
  }, [dq, filter, vessel, rank, page]);
  useEffect(() => { void load(); const i = setInterval(load, 30000); const f = () => void load(); window.addEventListener("focus", f); return () => { clearInterval(i); window.removeEventListener("focus", f); }; }, [load]);

  const pages = res ? Math.max(1, Math.ceil(res.total / PAGE)) : 1;
  const groups = view === "vessel" && res ? res.rows.reduce<Record<string, Row[]>>((a, r) => { const k = r.vessel || "Unassigned"; (a[k] ||= []).push(r); return a; }, {}) : null;

  const card = (r: Row) => (
    <button key={r.key} onClick={() => setOpen(r.key)} className="w-full text-left rounded-xl border border-border bg-card p-3 hover:border-primary transition-colors">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-foreground">{r.name || "Crew member"}</p>
        {r.crew_unique_id && <span className="text-[11px] font-mono text-primary">{r.crew_unique_id}</span>}
        <span className="ml-auto text-[10px] text-muted-foreground">{r.sources.map(s => SRC[s] || s).join(" · ")}</span>
      </div>
      <p className="text-xs text-muted-foreground">{[r.rank, r.nationality, r.vessel].filter(Boolean).join(" • ") || "—"}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">📜 {r.certs_total} certs</span>
        {r.certs_expired > 0 && <span className="rounded-full border border-destructive/50 px-2 py-0.5 text-destructive">{r.certs_expired} expired</span>}
        {r.certs_30 > 0 && <span className="rounded-full border border-destructive/40 px-2 py-0.5 text-destructive">{r.certs_30} ≤30 days</span>}
        {r.certs_90 > r.certs_30 && <span className="rounded-full border border-primary/50 px-2 py-0.5 text-primary">{r.certs_90 - r.certs_30} ≤90 days</span>}
        <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">⚓ {r.sea_count} sea service</span>
        {r.eng_avg !== null && <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">🗣 English {r.eng_avg}%</span>}
        {r.mods_total > 0 && <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">🎓 {r.mods_done}/{r.mods_total} modules</span>}
        {r.eng_last && <span className="rounded-full border border-emerald-400/40 px-2 py-0.5 text-emerald-400">Active {ago(r.eng_last)}</span>}
      </div>
    </button>
  );

  return (
    <div className="space-y-3">
      {!compact && <div>
        <p className="font-bold text-primary">👥 All my crew — live</p>
        <p className="text-xs text-muted-foreground">Company crew, interview and training invitees, and confirmed joinings in one list. Tap anyone for their full record.</p>
      </div>}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => { setFilter(k); setPage(0); }} className={`rounded-xl px-3 min-h-[38px] text-xs border ${filter === k ? "bg-primary text-primary-foreground border-primary font-semibold" : "border-border text-muted-foreground"}`}>
            {l} ({res?.counts?.[k] ?? 0})
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]"><Search size={14} className="absolute left-3 top-3.5 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, rank, Crew ID, vessel, nationality…" className="w-full rounded-xl border border-border bg-background pl-8 pr-3 min-h-[42px] text-sm text-foreground" /></div>
        <select value={vessel} onChange={e => { setVessel(e.target.value); setPage(0); }} className="rounded-xl border border-border bg-background px-2 min-h-[42px] text-sm text-foreground">
          <option value="">All vessels</option>{(res?.vessels || []).map(v => <option key={v.vessel} value={v.vessel}>{v.vessel} ({v.n})</option>)}
        </select>
        <select value={rank} onChange={e => { setRank(e.target.value); setPage(0); }} aria-label="Filter by rank" className="rounded-xl border border-border bg-background px-2 min-h-[42px] text-sm text-foreground">
          <option value="">All ranks</option>{(res?.ranks || []).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="flex rounded-xl border border-border overflow-hidden">
          <button onClick={() => setView("list")} aria-label="List view" className={`px-3 min-h-[42px] ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><List size={16} /></button>
          <button onClick={() => setView("vessel")} aria-label="Group by vessel" className={`px-3 min-h-[42px] ${view === "vessel" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><Ship size={16} /></button>
        </div>
      </div>

      {!res ? <p className="text-sm text-muted-foreground">Loading crew…</p>
        : res.rows.length === 0 ? <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{filter === "all" && !dq ? "No crew yet. Add company crew or send a training invitation — they appear here straight away." : "Nobody matches this filter."}</p>
        : groups ? Object.entries(groups).map(([v, rows]) => (
          <div key={v} className="space-y-2"><p className="text-xs font-bold uppercase tracking-wide text-primary">🚢 {v} · {rows.length}</p>{rows.map(card)}</div>))
        : <div className="space-y-2">{res.rows.map(card)}</div>}

      {res && res.total > PAGE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{page * PAGE + 1}–{Math.min((page + 1) * PAGE, res.total)} of {res.total}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded-xl border border-border px-3 min-h-[38px] disabled:opacity-40 flex items-center"><ChevronLeft size={14} /> Prev</button>
            <button disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)} className="rounded-xl border border-border px-3 min-h-[38px] disabled:opacity-40 flex items-center">Next <ChevronRight size={14} /></button>
          </div>
        </div>)}
      {open && <UnifiedCrewDossier k={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

const days = (x?: string) => { const m = /^\d{4}-\d{2}-\d{2}/.exec(x || ""); return m ? Math.floor((new Date(m[0]).getTime() - Date.now()) / 86400000) : null; };
const certExp = (c: any) => c?.expiry_date || c?.expiryDate || c?.expiry || "";
const certName = (c: any) => c?.name || c?.certificateName || c?.title || c?.cert_type || "Certificate";

export function UnifiedCrewDossier({ k, onClose }: { k: string; onClose: () => void }) {
  const [d, setD] = useState<any>(null); const [tab, setTab] = useState("cv");
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("manager_unified_crew_detail" as any, { p_key: k });
    if (error || !(data as any)?.ok) { toast.error("Could not open this crew record."); onClose(); return; }
    setD(data);
  }, [k, onClose]);
  useEffect(() => { void load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  const pdf = async () => {
    try {
      const [first, ...rest] = String(d.name || "").split(" ");
      const doc = await buildResumePdf({ personal: { firstName: first, lastName: rest.join(" "), first_name: first, last_name: rest.join(" "), rank: d.rank, nationality: d.nationality, email: d.email, phone: d.whatsapp, cdcNo: d.cdc_no, passportNo: d.passport_no, dateOfBirth: d.date_of_birth },
        sea: d.sea_service || [], certs: d.certificates || [], edu: [], training: [], skills: {}, photo: null, cvUid: d.crew_unique_id || "", declaration: null } as any);
      doc.save(`${String(d.name || "crew").replace(/\s+/g, "_")}_CV.pdf`);
    } catch { toast.error("PDF could not be created."); }
  };
  const TABS: [string, string][] = [["cv", "CV & sea service"], ["certs", "Certificates"], ["training", "Training & English"], ["contract", "Contract"]];

  return (
    <div className="fixed inset-0 z-50 bg-background/80 flex justify-end" onClick={onClose}>
      <div className="h-full w-full max-w-2xl bg-card border-l border-border overflow-y-auto p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="flex items-center gap-1 text-sm text-primary"><ChevronLeft size={18} /> Back</button>
          <button onClick={onClose} aria-label="Close" className="ml-auto text-muted-foreground"><X size={18} /></button>
        </div>
        {!d ? <p className="text-sm text-muted-foreground">Loading record…</p> : <>
          <div>
            <p className="text-lg font-bold text-foreground">{d.name} {d.crew_unique_id && <span className="text-sm font-mono text-primary">{d.crew_unique_id}</span>}</p>
            <p className="text-xs text-muted-foreground">{[d.rank, d.nationality, d.vessel].filter(Boolean).join(" • ")} · {(d.sources || []).map((s: string) => SRC[s] || s).join(" · ")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {d.whatsapp && <a href={`https://wa.me/${String(d.whatsapp).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="rounded-xl border border-primary text-primary px-3 min-h-[38px] text-xs flex items-center gap-1"><MessageCircle size={13} /> WhatsApp</a>}
              {d.whatsapp && <button onClick={() => shareZalo(`Hello ${d.name}`, d.whatsapp)} className="rounded-xl border border-primary text-primary px-3 min-h-[38px] text-xs">💙 Zalo</button>}
              {d.email && <a href={`mailto:${d.email}`} className="rounded-xl border border-primary text-primary px-3 min-h-[38px] text-xs flex items-center gap-1"><Mail size={13} /> Email</a>}
              <button onClick={pdf} className="rounded-xl bg-primary text-primary-foreground font-bold px-3 min-h-[38px] text-xs flex items-center gap-1"><FileDown size={13} /> Download CV (PDF)</button>
            </div>
            {!d.approved && d.crew_id && <p className="mt-2 text-[11px] text-primary">Full CV, certificates and contacts open once SeaMinds approves your company account.</p>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-secondary rounded-xl p-1">
            {TABS.map(([t, l]) => <button key={t} onClick={() => setTab(t)} className={`rounded-lg min-h-[40px] text-xs font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{l}</button>)}
          </div>

          {tab === "cv" && <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[["CDC / Seaman book", d.cdc_no], ["Passport", d.passport_no], ["Date of birth", d.date_of_birth], ["Email", d.email], ["WhatsApp", d.whatsapp]].filter(x => x[1]).map(([l, v]) => <div key={l} className="rounded-lg border border-border p-2"><p className="text-muted-foreground">{l}</p><p className="text-foreground">{v}</p></div>)}
            </div>
            {(d.sea_service || []).length === 0 ? <p className="text-sm text-muted-foreground">No sea service recorded yet.</p> :
              <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-xs"><thead className="bg-secondary text-muted-foreground"><tr>{["Vessel", "Type", "Rank", "From", "To"].map(h => <th key={h} className="text-left p-2">{h}</th>)}</tr></thead>
                <tbody>{d.sea_service.map((s: any, i: number) => <tr key={i} className="border-t border-border text-foreground">
                  <td className="p-2">{s.vessel_name || s.vesselName || s.vessel || "—"}</td><td className="p-2">{s.vessel_type || s.vesselType || s.type || "—"}</td>
                  <td className="p-2">{s.rank || s.position || "—"}</td><td className="p-2 whitespace-nowrap">{s.sign_on || s.signOn || s.from || s.start_date || "—"}</td><td className="p-2 whitespace-nowrap">{s.sign_off || s.signOff || s.to || s.end_date || "—"}</td></tr>)}</tbody></table></div>}
          </div>}

          {tab === "certs" && ((d.certificates || []).length === 0 ? <p className="text-sm text-muted-foreground">No certificates recorded yet.</p> :
            <div className="space-y-1.5">{[...d.certificates].sort((a: any, b: any) => (days(certExp(a)) ?? 99999) - (days(certExp(b)) ?? 99999)).map((c: any, i: number) => {
              const n = days(certExp(c)); const tone = n === null ? "text-muted-foreground border-border" : n < 0 ? "text-destructive border-destructive/50" : n <= 90 ? "text-primary border-primary/50" : "text-emerald-400 border-emerald-400/40";
              return <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs"><div className="flex-1"><p className="text-foreground">{certName(c)}</p>{(c.number || c.certificateNumber) && <p className="text-muted-foreground">{c.number || c.certificateNumber}</p>}</div>
                <span className={`rounded-full border px-2 py-0.5 whitespace-nowrap ${tone}`}>{n === null ? "No expiry" : n < 0 ? `Expired ${-n}d ago` : `${String(certExp(c)).slice(0, 10)} · ${n}d`}</span></div>;
            })}</div>)}

          {tab === "training" && <div className="space-y-3 text-xs">
            {(() => { const e = d.english || []; const avg = e.length ? Math.round(e.slice(0, 20).reduce((s: number, x: any) => s + Number(x.score || 0), 0) / Math.min(20, e.length)) : null;
              return <div className="rounded-xl border border-border p-3"><p className="font-semibold text-foreground">🗣 Maritime English</p>
                {avg === null ? <p className="text-muted-foreground">No voice drills yet.</p> : <><p className="text-muted-foreground">{e.length} recent drills · average {avg}% ({englishLevel(avg)}) · last {ago(e[0].at)}</p>
                  <div className="mt-2 flex items-end gap-0.5 h-16">{e.slice(0, 40).reverse().map((x: any, i: number) => <div key={i} title={`${x.scenario}: ${x.score}%`} className="flex-1 bg-primary/70 rounded-t" style={{ height: `${Math.max(4, Number(x.score))}%` }} />)}</div></>}</div>; })()}
            <div className="rounded-xl border border-border p-3"><p className="font-semibold text-foreground">🎓 Training modules</p>
              {(d.modules || []).length === 0 ? <p className="text-muted-foreground">None yet.</p> : d.modules.map((m: any, i: number) => <p key={i} className="text-muted-foreground">{m.status === "completed" ? "✓" : "•"} {m.title}{m.quiz_total ? ` — ${m.quiz_correct}/${m.quiz_total}` : ""}{m.completed_at ? ` · ${ago(m.completed_at)}` : ` · ${m.status}`}</p>)}</div>
            <div className="rounded-xl border border-border p-3"><p className="font-semibold text-foreground">🧭 AI interviews</p>
              {(d.interviews || []).length === 0 ? <p className="text-muted-foreground">None yet.</p> : d.interviews.map((s: any, i: number) => <div key={i} className="border-b border-border pb-2 last:border-0"><p className="text-muted-foreground">{s.rank || "Interview"}{s.framework === "four_in_one_v1" ? " · 4-part" : ""} · {s.status}{s.started_at ? ` · ${ago(s.started_at)}` : ""}{s.shared ? (s.technical_pct != null ? ` · ${s.technical_pct}% technical` : "") : " · result not shared by crew"}</p>{s.shared && s.framework === "four_in_one_v1" && <div className="mt-2"><FourPartScores scores={s.module_scores} compact /></div>}</div>)}</div>
          </div>}

          {tab === "contract" && ((d.contracts || []).length === 0 ? <p className="text-sm text-muted-foreground">No SEA contract with your company yet.</p> :
            <div className="space-y-1.5 text-xs">{d.contracts.map((c: any, i: number) => <div key={i} className="rounded-lg border border-border p-2"><p className="text-foreground font-semibold">{c.vessel || "Vessel"} · {c.status}</p><p className="text-muted-foreground">Start {c.start || "—"} · {c.months || "—"} months{c.wage ? ` · ${c.currency || "USD"} ${c.wage}/month` : ""}</p></div>)}</div>)}
          <p className="text-[11px] text-muted-foreground">Refreshes every 30 seconds. Wellness and private chats are never shown.</p>
        </>}
      </div>
    </div>
  );
}
