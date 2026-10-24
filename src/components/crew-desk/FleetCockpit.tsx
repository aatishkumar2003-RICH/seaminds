import { useEffect, useMemo, useState } from "react";
import { Ship, Users, Plane, AlarmClock, ShieldAlert, Wallet, X, FileText, ScrollText, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildCockpit, formatPayroll, type CockpitRoster, type CockpitRow, type Manning, type OperatingModel } from "@/lib/fleetCockpit";

const money = (n: number, cur = "USD") => `${cur} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const BAND = { ok: "text-emerald-400 border-emerald-400/40", plan: "text-amber-400 border-amber-400/40", critical: "text-destructive border-destructive/50" };

export default function FleetCockpit({ rows, onOpen, mode = "ship_manager" }: { rows: CockpitRoster[] | null; onOpen: (tab: "cv" | "contracts", id: string) => void; mode?: OperatingModel }) {
  const [contracts, setContracts] = useState<any[] | null>(null);
  const [manning, setManning] = useState<Manning[]>([]);
  const [filter, setFilter] = useState<"all" | "relief" | "mlc">("all");
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [selId, setSelId] = useState<string | null>(null);

  const load = () => {
    supabase.from("sea_contracts" as any).select("id,application_id,status,vessel_name,imo_number,flag_state,vessel_type,start_date,duration_months,currency,basic_wage,fixed_overtime,leave_pay,allowances,reliever_application_id").order("created_at")
      .then(({ data }) => setContracts((data as any) || []));
    supabase.from("vessel_manning" as any).select("vessel_name,required_complement").then(({ data }) => setManning((data as any) || []));
  };
  useEffect(load, []);

  const data = useMemo(() => buildCockpit(rows || [], contracts || [], new Date(), manning, mode), [rows, contracts, manning, mode]);
  if (!rows || !contracts) return <p className="text-sm text-muted-foreground">Loading fleet overview…</p>;
  const sel = selId ? data.rows.find(r => r.application_id === selId) || null : null;
  const setSel = (r: CockpitRow | null) => setSelId(r?.application_id || null);
  const liveContract = sel ? contracts.find(c => c.application_id === sel.application_id && ["issued", "signed"].includes(c.status)) : null;
  const relieverOptions = sel ? data.rows.filter(r => r.application_id !== sel.application_id && (r.state === "lineup" || r.state === "signedoff" || r.state === "pipeline")) : [];

  const setReliever = async (id: string) => {
    if (!liveContract) return;
    const { error } = await (supabase as any).from("sea_contracts").update({ reliever_application_id: id || null }).eq("id", liveContract.id);
    if (error) { toast.error(String(error.message).includes("contract_closed") ? "This contract is closed." : "Could not save the reliever."); return; }
    toast.success(id ? "Reliever nominated" : "Reliever removed"); load();
  };
  const setRequired = async (vessel: string, current: number | null) => {
    const v = prompt(`Minimum safe manning for ${vessel} (from the Safe Manning Document). Leave empty to clear.`, current ? String(current) : "");
    if (v === null) return;
    const n = parseInt(v, 10);
    const q = !v.trim() ? (supabase as any).from("vessel_manning").delete().eq("vessel_name", vessel)
      : Number.isFinite(n) && n >= 1 && n <= 80 ? (supabase as any).from("vessel_manning").upsert({ vessel_name: vessel, required_complement: n, updated_at: new Date().toISOString() }) : null;
    if (!q) { toast.error("Enter a number between 1 and 80."); return; }
    const { error } = await q;
    if (error) toast.error("Could not save safe manning."); else load();
  };

  const k = data.kpi;
  const tiles = [
    { label: "Active vessels", value: k.vessels, icon: Ship },
    { label: "Crew onboard", value: k.onboard, icon: Users },
    { label: "Lineup / travelling", value: k.lineup, icon: Plane },
    { label: k.reliefUnplanned ? `Relief due ≤30 d • ${k.reliefUnplanned} without reliever` : "Relief due ≤30 days", value: k.reliefDue, icon: AlarmClock, warn: k.reliefUnplanned > 0, f: "relief" as const },
    { label: "Over 270 days onboard", value: k.mlcCritical, icon: ShieldAlert, warn: k.mlcCritical > 0, f: "mlc" as const },
    { label: "Monthly payroll (signed)", value: formatPayroll(k.payroll), icon: Wallet },
  ];
  const show = (c: CockpitRow) => filter === "all" || (filter === "relief" ? c.daysToRelief !== null && c.daysToRelief <= 30 : c.band === "critical");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {tiles.map(t => (
          <button key={t.label} onClick={() => t.f && setFilter(filter === t.f ? "all" : t.f)}
            className={`text-left rounded-xl border bg-card p-3 ${t.warn ? "border-amber-400/50" : "border-border"} ${filter === t.f ? "ring-2 ring-primary" : ""}`}>
            <t.icon size={16} className={t.warn ? "text-amber-400" : "text-primary"} />
            <p className="mt-1 text-xl font-bold text-foreground tabular-nums">{t.value}</p>
            <p className="text-[11px] text-muted-foreground">{t.label}</p>
          </button>
        ))}
      </div>
      {filter !== "all" && <button onClick={() => setFilter("all")} className="text-xs text-primary">Showing {filter === "relief" ? "relief due" : "long service"} only — show all</button>}

      {data.vessels.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Your fleet appears here once crew confirm a joining. Issue and sign SEA contracts to see vessel details, relief dates and monthly payroll.
        </div>
      )}

      {data.vessels.map(v => {
        const crew = v.crew.filter(show);
        if (!crew.length) return null;
        const open = !closed[v.name];
        return (
          <div key={v.name} className="rounded-xl border border-border bg-card overflow-hidden">
            <button onClick={() => setClosed({ ...closed, [v.name]: open })} className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 bg-secondary text-left min-h-[48px]">
              {open ? <ChevronDown size={16} className="text-primary" /> : <ChevronRight size={16} className="text-primary" />}
              <span className="font-bold text-primary">{v.name}</span>
              <span className="text-xs text-muted-foreground">{[v.imo && `IMO ${v.imo}`, v.type, v.flag].filter(Boolean).join(" • ")}</span>
              <span className="ml-auto text-xs text-muted-foreground">{v.onboard}{v.required ? ` / ${v.required}` : ""} onboard • {formatPayroll(v.payroll)}/mo</span>
              <span role="button" tabIndex={0} onClick={e => { e.stopPropagation(); setRequired(v.name, v.required); }} className={`text-[11px] rounded-full border px-2 ${v.shortfall ? "border-destructive/50 text-destructive" : "border-border text-muted-foreground"}`}>{v.required === null ? (v.tracked ? "Set safe manning" : "We crew the full ship? Track safe manning") : v.shortfall ? `${v.shortfall} below safe manning` : "Safe manning met"}</span>
              {v.missingCritical > 0 && <span className="text-[11px] rounded-full border border-destructive/50 text-destructive px-2">{v.missingCritical} senior rank{v.missingCritical > 1 ? "s" : ""} missing</span>}
              {v.alerts > 0 && <span className="text-[11px] rounded-full border border-amber-400/50 text-amber-400 px-2">{v.alerts} alert{v.alerts > 1 ? "s" : ""}</span>}
            </button>
            {open && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[920px]">
                  <thead className="text-[11px] uppercase text-muted-foreground border-b border-border">
                    <tr>{["Rank", "Name", "Status", "Sign-on", "Days onboard", "Contract ends", "Relief in", "Reliever", "Monthly wage"].map(h => <th key={h} className="text-left font-medium px-4 py-2">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {crew.map(c => (
                      <tr key={c.application_id} onClick={() => setSel(c)} className="border-b border-border/50 hover:bg-secondary/60 cursor-pointer">
                        <td className="px-4 py-2.5 font-medium text-foreground">{c.rank || "—"}</td>
                        <td className="px-4 py-2.5 text-foreground">{c.name}<span className="text-muted-foreground text-xs"> {c.nationality}</span></td>
                        <td className="px-4 py-2.5 text-xs">{c.state === "onboard" ? "Onboard" : "Lineup"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{c.signOn || "—"}</td>
                        <td className="px-4 py-2.5">{c.daysOnboard !== null && c.band ? <span className={`text-xs border rounded-full px-2 tabular-nums ${BAND[c.band]}`}>{c.daysOnboard} d</span> : "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{c.contractEnd || "No contract"}</td>
                        <td className={`px-4 py-2.5 tabular-nums ${c.daysToRelief !== null && c.daysToRelief <= 30 ? "text-amber-400 font-semibold" : "text-muted-foreground"}`}>{c.daysToRelief === null ? "—" : c.daysToRelief < 0 ? `Overdue ${-c.daysToRelief} d` : `${c.daysToRelief} d`}</td>
                        <td className="px-4 py-2.5 text-xs">{c.reliever ? <span className={c.reliever.ready ? "text-emerald-400" : "text-amber-400"}>{c.reliever.name}{c.reliever.ready ? " ✓" : " (pending)"}</span> : c.daysToRelief !== null && c.daysToRelief <= 30 ? <span className="text-destructive">None</span> : "—"}</td>
                        <td className="px-4 py-2.5 tabular-nums text-foreground">{c.monthly ? money(c.monthly, c.currency) : <span className="text-xs text-muted-foreground">{c.contractStatus === "issued" ? "Awaiting signature" : "—"}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {filter === "all" && data.signedOff.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground mb-2">Signed off / on leave ({data.signedOff.length})</p>
          <div className="flex flex-wrap gap-2">
            {data.signedOff.map(c => <button key={c.application_id} onClick={() => setSel(c)} className="rounded-xl border border-border px-3 min-h-[40px] text-sm text-foreground hover:bg-secondary">{c.name} <span className="text-xs text-muted-foreground">{c.rank} • last {c.vessel}</span></button>)}
          </div>
        </div>
      )}

      {sel && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/60" onClick={() => setSel(null)}>
          <aside onClick={e => e.stopPropagation()} className="w-full max-w-md h-full bg-card border-l border-border p-5 space-y-4 overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-bold text-primary">{sel.name}</p>
                <p className="text-xs text-muted-foreground">{[sel.rank, sel.nationality, sel.vessel].filter(Boolean).join(" • ")}</p>
              </div>
              <button aria-label="Close" onClick={() => setSel(null)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-secondary"><X size={18} /></button>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[["Sign-on", sel.signOn || "—"], ["Days onboard", sel.daysOnboard ?? "—"], ["Contract ends", sel.contractEnd || "—"], ["Relief in", sel.daysToRelief === null ? "—" : `${sel.daysToRelief} days`], ["Contract", sel.contractStatus || "Not created"], ["Monthly wage", sel.monthly ? money(sel.monthly, sel.currency) : "—"]].map(([l, v]) => (
                <div key={l as string} className="rounded-lg border border-border p-2"><dt className="text-[11px] text-muted-foreground">{l}</dt><dd className="font-semibold text-foreground">{v}</dd></div>
              ))}
            </dl>
            {sel.band === "critical" && <p className="text-xs text-destructive">Over 270 days onboard — arrange relief before the 11-month limit.</p>}
            {sel.state === "signedoff" && <p className="text-xs text-muted-foreground">Contract completed — signed off / on leave. Available for the next contract.</p>}
            {liveContract && (
              <label className="block rounded-lg border border-border p-3">
                <span className="text-xs text-muted-foreground">Nominated reliever</span>
                <select value={liveContract.reliever_application_id || ""} onChange={e => setReliever(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 min-h-[44px] text-sm text-foreground">
                  <option value="">Not nominated</option>
                  {relieverOptions.map(r => <option key={r.application_id} value={r.application_id}>{r.name} — {r.rank || "rank?"} ({r.state === "lineup" ? "confirmed" : r.state === "signedoff" ? "on leave" : "not confirmed"})</option>)}
                </select>
                {sel.reliever && <p className={`mt-1 text-xs ${sel.reliever.ready ? "text-emerald-400" : "text-amber-400"}`}>{sel.reliever.ready ? "Reliever confirmed with signed SEA" : "Reliever needs joining confirmation and a signed SEA"}</p>}
              </label>
            )}
            <div className="grid gap-2">
              <button onClick={() => onOpen("contracts", sel.application_id)} className="flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-bold min-h-[44px]"><ScrollText size={16} /> SEA contract</button>
              <button onClick={() => onOpen("cv", sel.application_id)} className="flex items-center justify-center gap-2 rounded-xl border border-primary text-primary font-semibold min-h-[44px]"><FileText size={16} /> CV & principal formats</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
