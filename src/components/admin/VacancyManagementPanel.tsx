// SeaMinds Admin — Vacancy Management & Recruitment Intelligence.
// Read + filter + batch review work today. Archive/restore/delete are PENDING BACKEND
// ACTIVATION: admins have no UPDATE policy on job_postings, external_vacancies has no
// archive state, and audit logging must be database-enforced. Nothing bypasses RLS.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ageInDays, filterByMinAge, parseCustomDays, AGE_PRESETS } from "@/lib/managerVacancies";

type Kind = "direct" | "external";
export type AdminVacancyRow = {
  id: string; kind: Kind; company: string; recruiter: string; rank: string; vessel: string;
  source: string; status: string; created_at: string;
};
type AuditRow = { id: string; message: string; created_at: string; metadata: Record<string, unknown> | null };

const s = (v: unknown) => (v == null ? "" : String(v));
const has = (hay: string, needle: string) => !needle || hay.toLowerCase().includes(needle.trim().toLowerCase());

export const applyAdminFilters = (rows: AdminVacancyRow[], f: {
  kind: "all" | Kind; company: string; recruiter: string; rank: string; vessel: string; source: string; status: string; minAge: number | null;
}, now = Date.now()) =>
  filterByMinAge(rows.filter((r) =>
    (f.kind === "all" || r.kind === f.kind) && has(r.company, f.company) && has(r.recruiter, f.recruiter) &&
    has(r.rank, f.rank) && has(r.vessel, f.vessel) && (!f.source || r.source === f.source) && (!f.status || r.status === f.status),
  ), f.minAge, now);

const chip = (on: boolean) => `text-[11px] px-2.5 py-1.5 rounded-full border ${on ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37]" : "border-border text-muted-foreground"}`;
const inp = "h-9 rounded-lg border border-border bg-background px-2 text-xs text-foreground";

export default function VacancyManagementPanel() {
  const [rows, setRows] = useState<AdminVacancyRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<"all" | Kind>("all");
  const [company, setCompany] = useState(""); const [recruiter, setRecruiter] = useState("");
  const [rank, setRank] = useState(""); const [vessel, setVessel] = useState("");
  const [source, setSource] = useState(""); const [status, setStatus] = useState("");
  const [age, setAge] = useState<number | null>(null); const [custom, setCustom] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [d, e, a] = await Promise.all([
        supabase.from("job_postings").select("id, company_name, recruiter_name, rank_required, vessel_type, source_type, status, created_at").order("created_at", { ascending: false }).limit(1000),
        supabase.from("external_vacancies").select("id, company_name, rank_required, vessel_type, source, is_scam_flagged, expires_at, created_at").order("created_at", { ascending: false }).limit(1000),
        supabase.from("app_events").select("id, message, created_at, metadata").eq("event_type", "vacancy_cleanup").order("created_at", { ascending: false }).limit(20),
      ]);
      const now = new Date().toISOString();
      setRows([
        ...((d.data || []) as Record<string, unknown>[]).map((r) => ({
          id: s(r.id), kind: "direct" as const, company: s(r.company_name), recruiter: s(r.recruiter_name) || s(r.company_name),
          rank: s(r.rank_required), vessel: s(r.vessel_type), source: s(r.source_type) || "manual", status: s(r.status) || "active", created_at: s(r.created_at),
        })),
        ...((e.data || []) as Record<string, unknown>[]).map((r) => ({
          id: s(r.id), kind: "external" as const, company: s(r.company_name), recruiter: s(r.company_name),
          rank: s(r.rank_required), vessel: s(r.vessel_type), source: s(r.source) || "external",
          status: r.is_scam_flagged ? "scam_flagged" : s(r.expires_at) && s(r.expires_at) < now ? "expired" : "active", created_at: s(r.created_at),
        })),
      ]);
      setAudit((a.data || []) as AuditRow[]);
      setLoading(false);
    })();
  }, []);

  const minAge = custom ? parseCustomDays(custom) : age;
  const shown = useMemo(() => applyAdminFilters(rows, { kind, company, recruiter, rank, vessel, source, status, minAge }),
    [rows, kind, company, recruiter, rank, vessel, source, status, minAge]);
  const sources = useMemo(() => [...new Set(rows.map((r) => r.source))].sort(), [rows]);
  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status))].sort(), [rows]);
  const selCount = shown.filter((r) => selected.has(r.kind + r.id)).length;
  const toggle = (k: string) => setSelected((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <section className="space-y-3 rounded-xl border border-[#D4AF37]/30 bg-card p-4" aria-label="Vacancy management">
      <div>
        <h2 className="text-lg font-bold text-foreground">Vacancy Management &amp; Recruitment Intelligence</h2>
        <p className="text-[11px] text-muted-foreground">No vacancy expires automatically. Every change here is manual.</p>
      </div>
      <div className="rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-2 text-[11px] text-[#f59e0b]">
        Pending backend activation: archive, restore and delete need reviewed database permissions and audit logging. Direct vacancies shown are limited to what admin can currently read (public, verified, active).
        <br /><strong>Limited sample:</strong> up to 1,000 most recent records per source. These counts are NOT a complete platform-wide inventory.
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {[
          ["Shown (sample)", shown.length], ["Direct (sample)", shown.filter((r) => r.kind === "direct").length],
          ["External (sample)", shown.filter((r) => r.kind === "external").length], ["Selected", selCount],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg border border-[#D4AF37]/30 bg-[#0D1B2A] px-2 py-2">
            <p className="text-lg font-bold text-[#D4AF37] leading-none">{v}</p>
            <p className="text-[10px] uppercase text-muted-foreground mt-1">{l}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["all", "direct", "external"] as const).map((k) => <button key={k} className={chip(kind === k)} onClick={() => setKind(k)}>{k}</button>)}
        <span className="mx-1 text-border">|</span>
        <button className={chip(age === null && !custom)} onClick={() => { setAge(null); setCustom(""); }}>All ages</button>
        {AGE_PRESETS.map((d) => <button key={d} className={chip(age === d && !custom)} onClick={() => { setAge(d); setCustom(""); }}>{d}+ d</button>)}
        <input aria-label="Custom minimum age in days" className={`${inp} w-24`} placeholder="Custom days" value={custom} onChange={(e) => setCustom(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <input className={inp} placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
        <input className={inp} placeholder="Recruiter" value={recruiter} onChange={(e) => setRecruiter(e.target.value)} />
        <input className={inp} placeholder="Rank" value={rank} onChange={(e) => setRank(e.target.value)} />
        <input className={inp} placeholder="Vessel" value={vessel} onChange={(e) => setVessel(e.target.value)} />
        <select className={inp} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source"><option value="">All sources</option>{sources.map((x) => <option key={x}>{x}</option>)}</select>
        <select className={inp} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">All statuses</option>{statuses.map((x) => <option key={x}>{x}</option>)}</select>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        <button className="text-[11px] px-2 py-1 rounded-lg border border-border text-muted-foreground" onClick={() => setSelected(new Set(shown.map((r) => r.kind + r.id)))}>Select all shown</button>
        <button className="text-[11px] px-2 py-1 rounded-lg border border-border text-muted-foreground" onClick={() => setSelected(new Set())}>Clear</button>
        {["Archive", "Restore", "Delete"].map((a) => (
          <button key={a} disabled title="Pending backend activation" className="text-[11px] px-2 py-1 rounded-lg border border-border text-muted-foreground opacity-40 cursor-not-allowed">{a} ({selCount}) · pending</button>
        ))}
      </div>

      {loading ? <p className="text-xs text-muted-foreground">Loading vacancies…</p> : (
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#112240] text-muted-foreground"><tr>
              <th className="p-2" /><th className="p-2 text-left">Rank · Vessel</th><th className="p-2 text-left hidden sm:table-cell">Company / Recruiter</th>
              <th className="p-2 text-left">Type</th><th className="p-2 text-left hidden sm:table-cell">Source</th><th className="p-2 text-left">Status</th><th className="p-2 text-right">Age</th>
            </tr></thead>
            <tbody>
              {shown.slice(0, 300).map((r) => (
                <tr key={r.kind + r.id} className="border-t border-border/50">
                  <td className="p-2"><input type="checkbox" checked={selected.has(r.kind + r.id)} onChange={() => toggle(r.kind + r.id)} aria-label={`Select ${r.rank}`} /></td>
                  <td className="p-2 text-foreground">{r.rank || "—"} · {r.vessel || "—"}</td>
                  <td className="p-2 hidden sm:table-cell text-muted-foreground">{r.company || "—"}{r.recruiter && r.recruiter !== r.company ? ` / ${r.recruiter}` : ""}</td>
                  <td className="p-2 text-muted-foreground">{r.kind}</td>
                  <td className="p-2 hidden sm:table-cell text-muted-foreground">{r.source}</td>
                  <td className="p-2 text-muted-foreground">{r.status}</td>
                  <td className="p-2 text-right text-muted-foreground">{ageInDays(r.created_at)}d</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > 300 && <p className="p-2 text-[11px] text-muted-foreground">Showing first 300 of {shown.length}. Narrow the filters.</p>}
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
