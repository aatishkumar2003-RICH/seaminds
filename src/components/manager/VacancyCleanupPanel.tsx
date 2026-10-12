// "Manage & Clean My Vacancies" — manual-only lifecycle controls for the signed-in
// manager's OWN job_postings (RLS: manager_id = auth.uid()). No automatic expiry.
// Server-side paging, search, filters and exact counts scale to any inventory size.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logEvent } from "@/lib/logEvent";
import { AGE_PRESETS, ageInDays, canTransition, parseCustomDays } from "@/lib/managerVacancies";
import {
  loadManagerVacancyPage, loadManagerStatusCounts, loadApplicationCounts, requestLifecycleAction,
  LIFECYCLE_BACKEND, PENDING_LABEL, PAGE_SIZE, totalPages, MANAGER_STATUSES,
} from "@/lib/vacancyLifecycle";

/** Permanent deletion stays inactive until the secure backend RPC is approved. */
export const DELETE_PENDING = PENDING_LABEL;
export const PERMANENT_DELETE_ENABLED = LIFECYCLE_BACKEND.managerDelete;

export type CleanupPosting = {
  id: string;
  rank_required: string | null;
  vessel_type: string | null;
  joining_port?: string | null;
  status: string | null;
  created_at: string;
  positions?: number | null;
  source_type?: string | null;
  flier_url?: string | null;
  [k: string]: unknown;
};

type StatusFilter = "all" | (typeof MANAGER_STATUSES)[number];
type Pending =
  | { kind: "status"; to: "active" | "filled" | "archived"; ids: string[] }
  | { kind: "delete"; ids: string[] }
  | { kind: "blocked"; ids: string[]; apps: number };

const chip = (on: boolean) =>
  `text-[11px] px-2.5 py-1.5 min-h-[32px] rounded-full border ${on ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37]" : "border-border text-muted-foreground"}`;
const btn = "text-[11px] px-2 py-1 min-h-[32px] rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-40";
const VERB: Record<string, string> = { active: "Restore / reopen", filled: "Mark filled", archived: "Archive" };

export default function VacancyCleanupPanel({
  managerId, onEdit, onViewFlier, onChanged,
}: {
  managerId: string;
  onEdit: (row: CleanupPosting) => void;
  onViewFlier: (url: string) => void;
  onChanged: () => void;
}) {
  const [age, setAge] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<CleanupPosting[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [apps, setApps] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const customDays = parseCustomDays(custom);
  const minAge = custom ? customDays : age;

  // Debounce free-text search.
  useEffect(() => { const t = setTimeout(() => setTerm(search), 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(0); setSelected(new Set()); }, [term, status, minAge]);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const [pg, c] = await Promise.all([
        loadManagerVacancyPage<CleanupPosting>({ managerId, page, status, minAge, search: term }),
        loadManagerStatusCounts(managerId),
      ]);
      setRows(pg.rows); setTotal(pg.total); setCounts(c);
      try { setApps(await loadApplicationCounts(pg.rows.map((r) => r.id))); } catch { setApps({}); }
    } catch {
      setLoadError("Could not load your vacancies. Check your connection and try again.");
    } finally { setLoading(false); }
  }, [managerId, page, status, minAge, term]);
  useEffect(() => { load(); }, [load]);

  const selRows = rows.filter((r) => selected.has(r.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(selRows.length === rows.length ? new Set() : new Set(rows.map((r) => r.id)));
  const pages = totalPages(total);

  const requestStatus = (to: "active" | "filled" | "archived", ids: string[]) => {
    const ok = ids.filter((id) => canTransition(rows.find((p) => p.id === id)?.status || "active", to));
    if (!ok.length) { toast.error(`None of the selected vacancies can be changed to "${to}".`); return; }
    setPending({ kind: "status", to, ids: ok });
  };
  const requestDelete = (ids: string[]) => {
    if (!PERMANENT_DELETE_ENABLED) { toast.message(DELETE_PENDING); return; }
    setPending({ kind: "delete", ids });
  };

  const run = async () => {
    if (!pending || pending.kind === "blocked" || busy) return;
    setBusy(true);
    try {
      if (pending.kind === "status") {
        const { error } = await supabase.from("job_postings").update({ status: pending.to } as never).in("id", pending.ids).eq("manager_id", managerId);
        if (error) { toast.error(error.message); return; }
        await logEvent("vacancy_cleanup", `${VERB[pending.to]}: ${pending.ids.length}`, "info", { action: pending.to, ids: pending.ids, scope: "manager" });
        toast.success(`${pending.ids.length} vacanc${pending.ids.length === 1 ? "y" : "ies"} updated`);
      } else {
        // Single secure path: server enforces ownership, application protection and audit.
        const r = await requestLifecycleAction("manager", "direct", pending.ids, "delete");
        if (!r.ok) {
          if (!r.pending && r.blocked) { setPending({ kind: "blocked", ids: pending.ids, apps: r.blocked.applications }); return; }
          toast.error(r.message || "Not deleted."); return;
        }
        toast.success(`${r.affected ?? 0} vacanc${r.affected === 1 ? "y" : "ies"} permanently deleted`);
      }
      setSelected(new Set());
      setPending(null);
      await load();
      onChanged();
    } finally { setBusy(false); }
  };

  const deleteBtn = (ids: string[], label: string) => (
    <button
      className={`${btn} ${PERMANENT_DELETE_ENABLED ? "border-red-500/40 text-red-400" : "opacity-40 cursor-not-allowed"}`}
      disabled={!PERMANENT_DELETE_ENABLED || !ids.length}
      title={PERMANENT_DELETE_ENABLED ? undefined : DELETE_PENDING}
      aria-label={PERMANENT_DELETE_ENABLED ? label : `${label} — ${DELETE_PENDING}`}
      onClick={() => requestDelete(ids)}
    >{label}{PERMANENT_DELETE_ENABLED ? "" : ` · ${DELETE_PENDING}`}</button>
  );

  return (
    <section className="space-y-3" aria-label="Manage and clean my vacancies">
      <div>
        <p className="text-sm font-bold text-foreground">Manage &amp; Clean My Vacancies</p>
        <p className="text-[11px] text-muted-foreground">Nothing expires automatically. You decide when a vacancy is filled, archived or removed.</p>
      </div>

      <input
        value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rank, vessel, port or recruiter"
        aria-label="Search my vacancies"
        className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
      />

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Age filter">
        <button className={chip(age === null && !custom)} onClick={() => { setAge(null); setCustom(""); }}>All ages</button>
        {AGE_PRESETS.map((d) => (
          <button key={d} className={chip(age === d && !custom)} onClick={() => { setAge(d); setCustom(""); }}>{d}+ days</button>
        ))}
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <input
            inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Custom"
            aria-label="Custom minimum age in days"
            className="w-16 h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
          /> days+
        </label>
        {custom && customDays === null && <span className="text-[11px] text-[#f59e0b]">Enter whole days</span>}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status filter">
        {(["all", ...MANAGER_STATUSES] as StatusFilter[]).map((s) => (
          <button key={s} className={chip(status === s)} onClick={() => setStatus(s)}>
            {s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1)} ({counts[s] ?? "…"})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[#D4AF37]/30 bg-[#0D1B2A] p-2">
        <label className="flex items-center gap-1.5 text-[11px] text-foreground mr-1">
          <input type="checkbox" checked={rows.length > 0 && selRows.length === rows.length} onChange={toggleAll} aria-label="Select all on this page" />
          {selRows.length} selected on this page
        </label>
        <button className={btn} disabled={!selRows.length} onClick={() => requestStatus("filled", selRows.map((r) => r.id))}>Mark filled</button>
        <button className={btn} disabled={!selRows.length} onClick={() => requestStatus("archived", selRows.map((r) => r.id))}>Archive</button>
        <button className={btn} disabled={!selRows.length} onClick={() => requestStatus("active", selRows.map((r) => r.id))}>Restore / reopen</button>
        {deleteBtn(selRows.map((r) => r.id), "Delete permanently")}
      </div>

      <p className="text-[11px] text-muted-foreground" aria-live="polite">
        {loading ? "Loading…" : `${total.toLocaleString()} matching vacanc${total === 1 ? "y" : "ies"} · page ${page + 1} of ${pages}`}
      </p>

      {loadError ? (
        <div className="rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-3 text-xs text-[#f59e0b] space-y-2">
          <p>{loadError}</p>
          <button className={btn} onClick={load}>Try again</button>
        </div>
      ) : !loading && rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No vacancies match these filters.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => {
            const st = p.status || "active";
            const n = apps[p.id] ?? 0;
            return (
              <li key={p.id} className="rounded-lg border border-border/50 bg-secondary/50 px-3 py-2 space-y-2">
                <div className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.rank_required || "vacancy"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{[p.rank_required, p.vessel_type].filter(Boolean).join(" · ") || "Vacancy"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {ageInDays(p.created_at)} days old · {Math.max(Number(p.positions) || 1, 1)} position(s) · {n} applicant{n === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{st}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.flier_url && <button className={btn} onClick={() => onViewFlier(p.flier_url!)}>View flyer</button>}
                  <button className={btn} onClick={() => onEdit(p)}>Edit</button>
                  {canTransition(st, "filled") && <button className={btn} onClick={() => requestStatus("filled", [p.id])}>Mark filled</button>}
                  {canTransition(st, "archived") && <button className={btn} onClick={() => requestStatus("archived", [p.id])}>Archive</button>}
                  {canTransition(st, "active") && <button className={btn} onClick={() => requestStatus("active", [p.id])}>{st === "filled" ? "Reopen" : "Restore"}</button>}
                  {deleteBtn([p.id], "Delete")}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <button className={`${btn} min-h-[44px] px-4`} disabled={page === 0 || loading} onClick={() => setPage((x) => Math.max(0, x - 1))}>← Previous</button>
          <span className="text-[11px] text-muted-foreground">Page {page + 1} / {pages} · {PAGE_SIZE} per page</span>
          <button className={`${btn} min-h-[44px] px-4`} disabled={page + 1 >= pages || loading} onClick={() => setPage((x) => x + 1)}>Next →</button>
        </div>
      )}

      {pending && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-[#D4AF37]/40 bg-[#112240] p-4 space-y-3">
            {pending.kind === "blocked" ? (
              <>
                <p className="text-sm font-bold text-foreground">This vacancy can't be deleted</p>
                <p className="text-xs text-muted-foreground">
                  {pending.apps} seafarer application{pending.apps === 1 ? " is" : "s are"} linked to it. Deleting would erase their application history, so nothing was deleted.
                </p>
                <p className="text-xs text-muted-foreground">Archive instead: it disappears from seafarers' search and every application is kept.</p>
                <div className="flex gap-2">
                  <button className="flex-1 py-2.5 rounded-xl text-sm border border-border text-muted-foreground" onClick={() => setPending(null)}>Cancel</button>
                  <button className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#D4AF37] text-[#0D1B2A]" onClick={() => requestStatus("archived", pending.ids)}>Archive instead</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-foreground">
                  {pending.kind === "delete" ? `Delete ${pending.ids.length} vacanc${pending.ids.length === 1 ? "y" : "ies"} permanently?` : `${VERB[pending.to]} — ${pending.ids.length} vacanc${pending.ids.length === 1 ? "y" : "ies"}?`}
                </p>
                <ul className="max-h-40 overflow-y-auto text-xs text-muted-foreground list-disc pl-4">
                  {pending.ids.slice(0, 20).map((id) => {
                    const p = rows.find((x) => x.id === id);
                    return <li key={id}>{[p?.rank_required, p?.vessel_type].filter(Boolean).join(" · ") || "Vacancy"}</li>;
                  })}
                  {pending.ids.length > 20 && <li>…and {pending.ids.length - 20} more</li>}
                </ul>
                {pending.kind === "delete" && <p className="text-xs text-[#f59e0b]">This cannot be undone. Vacancies with applications are protected and will not be deleted.</p>}
                <div className="flex gap-2">
                  <button className="flex-1 py-2.5 rounded-xl text-sm border border-border text-muted-foreground" onClick={() => setPending(null)} disabled={busy}>Cancel</button>
                  <button
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 ${pending.kind === "delete" ? "bg-red-600 text-white" : "bg-[#D4AF37] text-[#0D1B2A]"}`}
                    onClick={run} disabled={busy}
                  >{busy ? "Working…" : pending.kind === "delete" ? "Delete permanently" : "Confirm"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
