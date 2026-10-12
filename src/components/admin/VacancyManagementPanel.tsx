// SeaMinds Admin — Vacancy Management & Recruitment Intelligence.
// Server-side paging, filters and exact counts per source (company / external).
// Archive / restore / delete go ONLY through requestLifecycleAction(), which stays
// pending until the reviewed backend RPC (permissions + application protection +
// audit log) is approved. Nothing here bypasses RLS.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ageInDays, filterByMinAge, parseCustomDays, AGE_PRESETS } from "@/lib/managerVacancies";
import {
  loadAdminVacancyPage, requestLifecycleAction, LIFECYCLE_BACKEND, PENDING_LABEL, PAGE_SIZE, totalPages,
  type VacancyKind, type LifecycleAction,
} from "@/lib/vacancyLifecycle";

type Kind = VacancyKind;
export type AdminVacancyRow = {
  id: string; kind: Kind; company: string; recruiter: string; rank: string; vessel: string;
  source: string; status: string; created_at: string;
};
type AuditRow = { id: string; message: string; created_at: string; metadata: Record<string, unknown> | null };

const s = (v: unknown) => (v == null ? "" : String(v));
const has = (hay: string, needle: string) => !needle || hay.toLowerCase().includes(needle.trim().toLowerCase());

/** Pure client-side filter (kept for in-memory use and tests). */
export const applyAdminFilters = (rows: AdminVacancyRow[], f: {
  kind: "all" | Kind; company: string; recruiter: string; rank: string; vessel: string; source: string; status: string; minAge: number | null;
}, now = Date.now()) =>
  filterByMinAge(rows.filter((r) =>
    (f.kind === "all" || r.kind === f.kind) && has(r.company, f.company) && has(r.recruiter, f.recruiter) &&
    has(r.rank, f.rank) && has(r.vessel, f.vessel) && (!f.source || r.source === f.source) && (!f.status || r.status === f.status),
  ), f.minAge, now);

export const toAdminRow = (kind: Kind, r: Record<string, unknown>): AdminVacancyRow => kind === "direct"
  ? { id: s(r.id), kind, company: s(r.company_name), recruiter: s(r.recruiter_name) || s(r.company_name), rank: s(r.rank_required),
      vessel: s(r.vessel_type), source: s(r.source_type) || "manual", status: s(r.status) || "active", created_at: s(r.created_at) }
  : { id: s(r.id), kind, company: s(r.company_name), recruiter: s(r.company_name), rank: s(r.rank_required), vessel: s(r.vessel_type),
      source: s(r.source) || "external", status: r.is_scam_flagged ? "scam_flagged" : "listed", created_at: s(r.created_at) };

const DIRECT_STATUSES = ["active", "filled", "archived", "expired"];
const EXTERNAL_STATUSES = ["listed", "scam_flagged"];
const DIRECT_SOURCES = ["manual", "text", "flier", "csv"];
const EXTERNAL_SOURCES = ["google_jobs", "rss_feed", "telegram", "internal"];

const chip = (on: boolean) => `text-[11px] px-2.5 py-1.5 rounded-full border ${on ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37]" : "border-border text-muted-foreground"}`;
const inp = "h-9 rounded-lg border border-border bg-background px-2 text-xs text-foreground";
const btn = "text-[11px] px-2 py-1 min-h-[32px] rounded-lg border border-border text-muted-foreground disabled:opacity-40";

export default function VacancyManagementPanel() {
  const [kind, setKind] = useState<Kind>("direct");
  const [company, setCompany] = useState(""); const [rank, setRank] = useState(""); const [vessel, setVessel] = useState("");
  const [source, setSource] = useState(""); const [status, setStatus] = useState("");
  const [age, setAge] = useState<number | null>(null); const [custom, setCustom] = useState("");
  const [f, setF] = useState({ company: "", rank: "", vessel: "" });
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AdminVacancyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const minAge = custom ? parseCustomDays(custom) : age;
  useEffect(() => { const t = setTimeout(() => setF({ company, rank, vessel }), 350); return () => clearTimeout(t); }, [company, rank, vessel]);
  useEffect(() => { setPage(0); setSelected(new Set()); }, [kind, f, source, status, minAge]);
  useEffect(() => { setSource(""); setStatus(""); }, [kind]);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const r = await loadAdminVacancyPage({ kind, page, ...f, source, status, minAge });
      setRows(r.rows.map((x) => toAdminRow(kind, x))); setTotal(r.total);
    } catch { setErr("Could not load vacancies. Try again."); }
    finally { setLoading(false); }
  }, [kind, page, f, source, status, minAge]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from("app_events").select("id, message, created_at, metadata").eq("event_type", "vacancy_cleanup")
      .order("created_at", { ascending: false }).limit(20).then(({ data }) => setAudit((data || []) as AuditRow[]));
  }, []);

  const pages = totalPages(total);
  const selIds = rows.filter((r) => selected.has(r.id)).map((r) => r.id);
  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const act = async (a: LifecycleAction) => {
    if (!selIds.length) return;
    if (a === "delete" && LIFECYCLE_BACKEND.adminActions && !window.confirm(`Delete ${selIds.length} vacancies permanently? Vacancies with applications are protected.`)) return;
    const r = await requestLifecycleAction("admin", kind, selIds, a);
    if (r.ok) { toast.success(`${r.affected} updated`); setSelected(new Set()); load(); }
    else if (!r.pending && r.blocked) toast.error(`${r.blocked.applications} applications are linked — archive instead.`);
    else toast.message(r.message);
  };

  return (
    <section className="space-y-3 rounded-xl border border-[#D4AF37]/30 bg-card p-4" aria-label="Vacancy management">
      <div>
        <h2 className="text-lg font-bold text-foreground">Vacancy Management &amp; Recruitment Intelligence</h2>
        <p className="text-[11px] text-muted-foreground">No vacancy expires automatically. Every change here is manual.</p>
      </div>

      {!LIFECYCLE_BACKEND.adminActions && (
        <div className="rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-2 text-[11px] text-[#f59e0b]">
          {PENDING_LABEL}: archive, restore and delete need the reviewed database permissions, application protection and audit logging.
          Company vacancy counts reflect only rows admin can currently read.
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 items-center">
        <button className={chip(kind === "direct")} onClick={() => setKind("direct")}>Company vacancies</button>
        <button className={chip(kind === "external")} onClick={() => setKind("external")}>External vacancies</button>
        <span className="mx-1 text-border">|</span>
        <button className={chip(age === null && !custom)} onClick={() => { setAge(null); setCustom(""); }}>All ages</button>
        {AGE_PRESETS.map((d) => <button key={d} className={chip(age === d && !custom)} onClick={() => { setAge(d); setCustom(""); }}>{d}+ d</button>)}
        <input aria-label="Custom minimum age in days" className={`${inp} w-24`} placeholder="Custom days" value={custom} onChange={(e) => setCustom(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <input className={inp} placeholder={kind === "direct" ? "Company / recruiter" : "Company"} value={company} onChange={(e) => setCompany(e.target.value)} />
        <input className={inp} placeholder="Rank" value={rank} onChange={(e) => setRank(e.target.value)} />
        <input className={inp} placeholder="Vessel" value={vessel} onChange={(e) => setVessel(e.target.value)} />
        <select className={inp} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
          <option value="">All sources</option>{(kind === "direct" ? DIRECT_SOURCES : EXTERNAL_SOURCES).map((x) => <option key={x}>{x}</option>)}
        </select>
        <select className={inp} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>{(kind === "direct" ? DIRECT_STATUSES : EXTERNAL_STATUSES).map((x) => <option key={x}>{x}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-[11px] text-foreground mr-1" aria-live="polite">
          {loading ? "Loading…" : `${total.toLocaleString()} matching · page ${page + 1} of ${pages}`} · {selIds.length} selected
        </span>
        <button className={btn} onClick={() => setSelected(new Set(rows.map((r) => r.id)))}>Select page</button>
        <button className={btn} onClick={() => setSelected(new Set())}>Clear</button>
        {(["archive", "restore", "delete"] as LifecycleAction[]).map((a) => (
          <button key={a} disabled={!LIFECYCLE_BACKEND.adminActions || !selIds.length} title={LIFECYCLE_BACKEND.adminActions ? undefined : PENDING_LABEL}
            className={`${btn} ${a === "delete" && LIFECYCLE_BACKEND.adminActions ? "border-red-500/40 text-red-400" : ""}`} onClick={() => act(a)}>
            {a[0].toUpperCase() + a.slice(1)} ({selIds.length}){LIFECYCLE_BACKEND.adminActions ? "" : " · pending"}
          </button>
        ))}
      </div>

      {err ? (
        <div className="text-xs text-[#f59e0b] space-y-1"><p>{err}</p><button className={btn} onClick={load}>Try again</button></div>
      ) : (
        <div className="max-h-[480px] overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#112240] text-muted-foreground"><tr>
              <th className="p-2" /><th className="p-2 text-left">Rank · Vessel</th><th className="p-2 text-left hidden sm:table-cell">Company / Recruiter</th>
              <th className="p-2 text-left hidden sm:table-cell">Source</th><th className="p-2 text-left">Status</th><th className="p-2 text-right">Age</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/50">
                  <td className="p-2"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.rank}`} /></td>
                  <td className="p-2 text-foreground">{r.rank || "—"} · {r.vessel || "—"}</td>
                  <td className="p-2 hidden sm:table-cell text-muted-foreground">{r.company || "—"}{r.recruiter && r.recruiter !== r.company ? ` / ${r.recruiter}` : ""}</td>
                  <td className="p-2 hidden sm:table-cell text-muted-foreground">{r.source}</td>
                  <td className="p-2 text-muted-foreground">{r.status}</td>
                  <td className="p-2 text-right text-muted-foreground">{ageInDays(r.created_at)}d</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">No vacancies match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button className={btn} disabled={page === 0 || loading} onClick={() => setPage((x) => Math.max(0, x - 1))}>← Previous</button>
          <span className="text-[11px] text-muted-foreground">{PAGE_SIZE} per page</span>
          <button className={btn} disabled={page + 1 >= pages || loading} onClick={() => setPage((x) => x + 1)}>Next →</button>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-foreground">Cleanup audit history</h3>
        {audit.length === 0 ? <p className="text-[11px] text-muted-foreground">No manual cleanup actions recorded yet.</p> : (
          <ul className="text-[11px] text-muted-foreground space-y-0.5">
            {audit.map((a) => <li key={a.id}>{new Date(a.created_at).toLocaleString()} — {a.message} ({s(a.metadata?.scope) || "—"})</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
