import { endDate, monthlyTotal, type Allowance } from "@/lib/seaContract";

export type CockpitRoster = { application_id: string; outcome: string; crew_name: string; rank: string; nationality: string; vessel: string; joining_date: string | null; crew_confirmed: boolean };
export type CockpitContract = { application_id: string; status: string; vessel_name: string; imo_number: string; flag_state: string; vessel_type: string; start_date: string | null; duration_months: number; currency: string; basic_wage: number; fixed_overtime: number; leave_pay: number; allowances: Allowance[]; reliever_application_id?: string | null };
export type Manning = { vessel_name: string; required_complement: number };

export type CrewState = "onboard" | "lineup" | "signedoff" | "pipeline";
export type MlcBand = "ok" | "plan" | "critical";
export type CockpitRow = {
  application_id: string; name: string; rank: string; nationality: string; vessel: string;
  state: CrewState; signOn: string | null; daysOnboard: number | null; band: MlcBand | null;
  contractEnd: string | null; daysToRelief: number | null; monthly: number; currency: string; contractStatus: string | null;
  reliever: { application_id: string; name: string; rank: string; ready: boolean } | null;
};

const DAY = 86400000;
const days = (from: string, to: Date) => Math.floor((to.getTime() - new Date(from + "T00:00:00Z").getTime()) / DAY);
/** Senior ranks whose absence is a safe-manning risk. */
export const CRITICAL_RANKS = [/master|captain/i, /chief eng|c\/e/i, /chief (mate|officer)|c\/o/i, /(2nd|second) eng/i];

/** MLC-style service band: 0–180 normal, 181–270 plan relief, >270 critical (11-month ceiling approaching). */
export function mlcBand(daysOnboard: number): MlcBand {
  return daysOnboard > 270 ? "critical" : daysOnboard > 180 ? "plan" : "ok";
}

const addMoney = (m: Record<string, number>, cur: string, n: number) => { if (n) m[cur] = Math.round(((m[cur] || 0) + n) * 100) / 100; return m; };

export type OperatingModel = "crewing_agency" | "ship_manager";
export function buildCockpit(roster: CockpitRoster[], contracts: CockpitContract[], today = new Date(), manning: Manning[] = [], mode: OperatingModel = "ship_manager") {
  const live = new Map<string, CockpitContract>(), done = new Map<string, CockpitContract>();
  for (const c of contracts) {
    if (["issued", "signed"].includes(c.status)) live.set(c.application_id, c);
    else if (c.status === "completed") done.set(c.application_id, c);
  }
  const byId = new Map(roster.map(r => [r.application_id, r]));
  const signedIds = new Set(contracts.filter(c => c.status === "signed").map(c => c.application_id));

  const rows: CockpitRow[] = roster.map(r => {
    const c = live.get(r.application_id);
    const completed = !c && done.has(r.application_id);
    const signOn = c?.start_date || (completed ? done.get(r.application_id)!.start_date : null) || r.joining_date || null;
    const started = !!signOn && days(signOn, today) >= 0;
    const state: CrewState = completed ? "signedoff"
      : r.crew_confirmed && started && (c?.status === "signed" || r.outcome === "placed") ? "onboard" : r.crew_confirmed ? "lineup" : "pipeline";
    const daysOnboard = state === "onboard" && signOn ? days(signOn, today) : null;
    const contractEnd = c ? endDate(c.start_date, Number(c.duration_months)) : null;
    const rel = c?.reliever_application_id ? byId.get(c.reliever_application_id) : undefined;
    return {
      application_id: r.application_id, name: r.crew_name || "Crew", rank: r.rank, nationality: r.nationality,
      vessel: c?.vessel_name || (completed ? done.get(r.application_id)!.vessel_name : "") || r.vessel || "Unassigned vessel", state, signOn, daysOnboard,
      band: daysOnboard === null ? null : mlcBand(daysOnboard), contractEnd,
      daysToRelief: contractEnd && state === "onboard" ? -days(contractEnd, today) : null,
      monthly: state === "onboard" && c?.status === "signed" ? monthlyTotal(c) : 0, currency: c?.currency || "USD",
      contractStatus: c?.status || (completed ? "completed" : null),
      reliever: rel ? { application_id: rel.application_id, name: rel.crew_name || "Crew", rank: rel.rank, ready: rel.crew_confirmed && signedIds.has(rel.application_id) } : null,
    };
  });

  const onboard = rows.filter(r => r.state === "onboard");
  const vessels = new Map<string, CockpitRow[]>();
  for (const r of rows.filter(r => r.state === "onboard" || r.state === "lineup")) vessels.set(r.vessel, [...(vessels.get(r.vessel) || []), r]);
  const meta = new Map<string, CockpitContract>();
  for (const c of live.values()) if (c.vessel_name) meta.set(c.vessel_name, c);
  const req = new Map(manning.map(m => [m.vessel_name, m.required_complement]));
  const reliefDue = (r: CockpitRow) => r.daysToRelief !== null && r.daysToRelief <= 30;

  return {
    rows,
    signedOff: rows.filter(r => r.state === "signedoff"),
    kpi: {
      vessels: new Set(onboard.map(r => r.vessel)).size,
      onboard: onboard.length,
      lineup: rows.filter(r => r.state === "lineup").length,
      reliefDue: onboard.filter(reliefDue).length,
      reliefUnplanned: onboard.filter(r => reliefDue(r) && !r.reliever).length,
      mlcCritical: onboard.filter(r => r.band === "critical").length,
      payroll: onboard.reduce((m, r) => addMoney(m, r.currency, r.monthly), {} as Record<string, number>),
    },
    vessels: [...vessels.entries()].map(([name, crew]) => {
      const ob = crew.filter(c => c.state === "onboard");
      const required = req.get(name) ?? null;
      // Crewing agencies supply single positions: safe manning only applies where they crew the whole ship.
      const tracked = mode === "ship_manager" || required !== null;
      const missingCritical = tracked && ob.length ? CRITICAL_RANKS.filter(re => !ob.some(c => re.test(c.rank || ""))).length : 0;
      return {
        name, imo: meta.get(name)?.imo_number || "", flag: meta.get(name)?.flag_state || "", type: meta.get(name)?.vessel_type || "",
        crew: crew.sort((a, b) => (a.daysToRelief ?? 9999) - (b.daysToRelief ?? 9999)),
        onboard: ob.length, required, tracked, shortfall: required !== null ? Math.max(0, required - ob.length) : 0, missingCritical,
        payroll: ob.reduce((m, c) => addMoney(m, c.currency, c.monthly), {} as Record<string, number>),
        alerts: crew.filter(c => (reliefDue(c) && !c.reliever) || c.band === "critical").length + (required !== null && required > ob.length ? 1 : 0),
      };
    }).sort((a, b) => b.alerts - a.alerts || b.onboard - a.onboard),
  };
}

export const formatPayroll = (m: Record<string, number>) => {
  const e = Object.entries(m);
  return e.length ? e.map(([c, n]) => `${c} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`).join(" + ") : "—";
};
