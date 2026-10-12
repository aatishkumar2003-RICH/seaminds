// "Manage & Clean My Vacancies" — manual-only lifecycle controls for the signed-in
// manager's OWN job_postings (RLS: manager_id = auth.uid()). No automatic expiry.
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logEvent } from "@/lib/logEvent";
import {
  AGE_PRESETS, ageInDays, canTransition, decidePermanentDelete, filterByMinAge, parseCustomDays,
} from "@/lib/managerVacancies";

export type CleanupPosting = {
  id: string;
  rank_required: string | null;
  vessel_type: string | null;
  status: string | null;
  created_at: string;
  positions?: number | null;
  source_type?: string | null;
  flier_url?: string | null;
};

type StatusFilter = "all" | "active" | "filled" | "archived" | "expired";
type Pending =
  | { kind: "status"; to: "active" | "filled" | "archived"; ids: string[] }
  | { kind: "delete"; ids: string[] }
  | { kind: "blocked"; ids: string[]; apps: number };

const chip = (on: boolean) =>
  `text-[11px] px-2.5 py-1.5 min-h-[32px] rounded-full border ${on ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37]" : "border-border text-muted-foreground"}`;
const btn = "text-[11px] px-2 py-1 min-h-[32px] rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-40";

const VERB: Record<string, string> = { active: "Restore / reopen", filled: "Mark filled", archived: "Archive" };

export default function VacancyCleanupPanel({
  postings, applicantCount, onEdit, onViewFlier, onChanged,
}: {
  postings: CleanupPosting[];
  applicantCount: (id: string) => number;
  onEdit: (id: string) => void;
  onViewFlier: (url: string) => void;
  onChanged: () => void;
}) {
  const [age, setAge] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const customDays = parseCustomDays(custom);
  const minAge = custom ? customDays : age;
  const rows = useMemo(() => {
    const byStatus = status === "all" ? postings : postings.filter((p) => (p.status || "active") === status);
    return filterByMinAge(byStatus, minAge);
  }, [postings, status, minAge]);
  const selRows = rows.filter((r) => selected.has(r.id));

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(selRows.length === rows.length ? new Set() : new Set(rows.map((r) => r.id)));

  const requestStatus = (to: "active" | "filled" | "archived", ids: string[]) => {
    const ok = ids.filter((id) => canTransition(postings.find((p) => p.id === id)?.status || "active", to));
    if (!ok.length) { toast.error(`None of the selected vacancies can be changed to "${to}".`); return; }
    setPending({ kind: "status", to, ids: ok });
  };
  const requestDelete = (ids: string[]) => {
    const apps = ids.reduce((n, id) => n + applicantCount(id), 0);
    const d = decidePermanentDelete(apps);
    setPending(d.allowed ? { kind: "delete", ids } : { kind: "blocked", ids, apps });
  };

  const run = async () => {
    if (!pending || pending.kind === "blocked" || busy) return;
    setBusy(true);
    try {
      if (pending.kind === "status") {
        const { error } = await supabase.from("job_postings").update({ status: pending.to } as never).in("id", pending.ids);
        if (error) { toast.error(error.message); return; }
        await logEvent("vacancy_cleanup", `${VERB[pending.to]}: ${pending.ids.length}`, "info", { action: pending.to, ids: pending.ids, scope: "manager" });
        toast.success(`${pending.ids.length} vacanc${pending.ids.length === 1 ? "y" : "ies"} updated`);
      } else {
        // Re-check applications right before deleting (defence in depth).
        const { count, error: cErr } = await supabase.from("job_applications").select("id", { count: "exact", head: true }).in("job_posting_id", pending.ids);
        if (cErr) { toast.error("Could not confirm there are no applications. Nothing was deleted."); return; }
        if ((count || 0) > 0) { setPending({ kind: "blocked", ids: pending.ids, apps: count || 0 }); return; }
        const { error } = await supabase.from("job_postings").delete().in("id", pending.ids);
        if (error) { toast.error(error.message); return; }
        await logEvent("vacancy_cleanup", `Deleted: ${pending.ids.length}`, "warning", { action: "delete", ids: pending.ids, scope: "manager" });
        toast.success(`${pending.ids.length} vacanc${pending.ids.length === 1 ? "y" : "ies"} permanently deleted`);
      }
      setSelected(new Set());
      setPending(null);
      onChanged();
    } finally { setBusy(false); }
  };

  const titleOf = (id: string) => {
    const p = postings.find((x) => x.id === id);
    return `${[p?.rank_required, p?.vessel_type].filter(Boolean).join(" · ") || "Vacancy"} — ${p ? ageInDays(p.created_at) : 0}d old`;
  };

  return (
    <section aria-label="Manage and clean my vacancies" className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-[#D4AF37]">Manage &amp; Clean My Vacancies</h3>
        <p className="text-[11px] text-muted-foreground">Vacancies never expire automatically. Nothing changes unless you choose it here. Only your company's vacancies are shown.</p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Age filter">
        <button className={chip(age === null && !custom)} onClick={() => { setAge(null); setCustom(""); }}>All ages</button>
        {AGE_PRESETS.map((d) => (
          <button key={d} className={chip(age === d && !custom)} onClick={() => { setAge(d); setCustom(""); }}>{d}+ days</button>
        ))}
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <input
            inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Custom"
            aria-label="Custom minimum age in days"
            className="w-20 rounded-full border border-border bg-background px-2.5 py-1.5 text-foreground"
          /> days+
        </label>
        {custom && customDays === null && <span className="text-[11px] text-[#f59e0b]">Enter whole days</span>}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status filter">
        {(["all", "active", "filled", "archived", "expired"] as StatusFilter[]).map((s) => (
          <button key={s} className={chip(status === s)} onClick={() => setStatus(s)}>
            {s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1)} ({s === "all" ? postings.length : postings.filter((p) => (p.status || "active") === s).length})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[#D4AF37]/30 bg-[#0D1B2A] p-2">
        <label className="flex items-center gap-1.5 text-[11px] text-foreground mr-1">
          <input type="checkbox" checked={rows.length > 0 && selRows.length === rows.length} onChange={toggleAll} aria-label="Select all shown" />
          {selRows.length} of {rows.length} selected
        </label>
        <button className={btn} disabled={!selRows.length} onClick={() => requestStatus("filled", selRows.map((r) => r.id))}>Mark filled</button>
        <button className={btn} disabled={!selRows.length} onClick={() => requestStatus("archived", selRows.map((r) => r.id))}>Archive</button>
        <button className={btn} disabled={!selRows.length} onClick={() => requestStatus("active", selRows.map((r) => r.id))}>Restore / reopen</button>
        <button className={`${btn} border-red-500/40 text-red-400`} disabled={!selRows.length} onClick={() => requestDelete(selRows.map((r) => r.id))}>Delete permanently</button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No vacancies match these filters.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => {
            const st = p.status || "active";
            const apps = applicantCount(p.id);
            return (
              <li key={p.id} className="rounded-lg border border-border/50 bg-secondary/50 px-3 py-2 space-y-2">
                <div className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.rank_required || "vacancy"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{[p.rank_required, p.vessel_type].filter(Boolean).join(" · ") || "Vacancy"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {ageInDays(p.created_at)} days old · {Math.max(Number(p.positions) || 1, 1)} position(s) · {apps} applicant{apps === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{st}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.flier_url && <button className={btn} onClick={() => onViewFlier(p.flier_url!)}>View flyer</button>}
                  <button className={btn} onClick={() => onEdit(p.id)}>Edit</button>
                  {canTransition(st, "filled") && <button className={btn} onClick={() => requestStatus("filled", [p.id])}>Mark filled</button>}
                  {canTransition(st, "archived") && <button className={btn} onClick={() => requestStatus("archived", [p.id])}>Archive</button>}
                  {canTransition(st, "active") && <button className={btn} onClick={() => requestStatus("active", [p.id])}>{st === "filled" ? "Reopen" : "Restore"}</button>}
                  <button className={`${btn} border-red-500/40 text-red-400`} onClick={() => requestDelete([p.id])}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pending && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-[#D4AF37]/40 bg-[#112240] p-4 space-y-3">
            {pending.kind === "blocked" ? (
              <>
                <p className="text-sm font-bold text-foreground">Permanent deletion is blocked</p>
                <p className="text-xs text-muted-foreground">
                  {pending.apps} application{pending.apps === 1 ? " is" : "s are"} linked to the selected vacanc{pending.ids.length === 1 ? "y" : "ies"}. Deleting would remove seafarers' application records, so nothing was deleted.
                </p>
                <p className="text-xs text-muted-foreground">You can archive instead. Archiving hides the vacancy from seafarers and keeps every application.</p>
                <div className="flex gap-2">
                  <button className="flex-1 py-2.5 rounded-xl text-sm border border-border text-muted-foreground" onClick={() => setPending(null)}>Cancel</button>
                  <button className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-[#D4AF37] text-[#D4AF37]" onClick={() => requestStatus("archived", pending.ids)}>Review archive instead</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-foreground">
                  {pending.kind === "delete" ? `Permanently delete ${pending.ids.length} vacanc${pending.ids.length === 1 ? "y" : "ies"}?` : `${VERB[pending.to]} — ${pending.ids.length} vacanc${pending.ids.length === 1 ? "y" : "ies"}?`}
                </p>
                <ul className="max-h-40 overflow-y-auto text-xs text-muted-foreground list-disc pl-4">
                  {pending.ids.map((id) => <li key={id}>{titleOf(id)}</li>)}
                </ul>
                {pending.kind === "delete" && <p className="text-xs text-red-400">This cannot be undone.</p>}
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
