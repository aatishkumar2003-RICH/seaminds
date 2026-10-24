import { endDate, monthlyTotal, type Allowance } from "@/lib/seaContract";

export type CockpitRoster = { application_id: string; outcome: string; crew_name: string; rank: string; nationality: string; vessel: string; joining_date: string | null; crew_confirmed: boolean };
export type CockpitContract = { application_id: string; status: string; vessel_name: string; imo_number: string; flag_state: string; vessel_type: string; start_date: string | null; duration_months: number; currency: string; basic_wage: number; fixed_overtime: number; leave_pay: number; allowances: Allowance[] };

export type CrewState = "onboard" | "lineup" | "pipeline";
export type MlcBand = "ok" | "plan" | "critical";
export type CockpitRow = {
  application_id: string; name: string; rank: string; nationality: string; vessel: string;
  state: CrewState; signOn: string | null; daysOnboard: number | null; band: MlcBand | null;
  contractEnd: string | null; daysToRelief: number | null; monthly: number; currency: string; contractStatus: string | null;
};

const DAY = 86400000;
const days = (from: string, to: Date) => Math.floor((to.getTime() - new Date(from + "T00:00:00Z").getTime()) / DAY);

/** MLC-style service band: 0–180 normal, 181–270 plan relief, >270 critical (11-month ceiling approaching). */
export function mlcBand(daysOnboard: number): MlcBand {
  return daysOnboard > 270 ? "critical" : daysOnboard > 180 ? "plan" : "ok";
}

export function buildCockpit(roster: CockpitRoster[], contracts: CockpitContract[], today = new Date()) {
  const live = new Map<string, CockpitContract>();
  for (const c of contracts) if (["issued", "signed"].includes(c.status)) live.set(c.application_id, c);

  const rows: CockpitRow[] = roster.map(r => {
    const c = live.get(r.application_id);
    const signOn = c?.start_date || r.joining_date || null;
    const started = !!signOn && days(signOn, today) >= 0;
    const state: CrewState = r.crew_confirmed && started && (c?.status === "signed" || r.outcome === "placed") ? "onboard" : r.crew_confirmed ? "lineup" : "pipeline";
    const daysOnboard = state === "onboard" && signOn ? days(signOn, today) : null;
    const contractEnd = c ? endDate(c.start_date, Number(c.duration_months)) : null;
    return {
      application_id: r.application_id, name: r.crew_name || "Crew", rank: r.rank, nationality: r.nationality,
      vessel: c?.vessel_name || r.vessel || "Unassigned vessel", state, signOn, daysOnboard,
      band: daysOnboard === null ? null : mlcBand(daysOnboard), contractEnd,
      daysToRelief: contractEnd ? -days(contractEnd, today) : null,
      monthly: c?.status === "signed" ? monthlyTotal(c) : 0, currency: c?.currency || "USD", contractStatus: c?.status || null,
    };
  });

  const onboard = rows.filter(r => r.state === "onboard");
  const vessels = new Map<string, CockpitRow[]>();
  for (const r of rows.filter(r => r.state !== "pipeline")) vessels.set(r.vessel, [...(vessels.get(r.vessel) || []), r]);
  const meta = new Map<string, CockpitContract>();
  for (const c of live.values()) if (c.vessel_name) meta.set(c.vessel_name, c);

  return {
    rows,
    kpi: {
      vessels: new Set(onboard.map(r => r.vessel)).size,
      onboard: onboard.length,
      lineup: rows.filter(r => r.state === "lineup").length,
      reliefDue: onboard.filter(r => r.daysToRelief !== null && r.daysToRelief <= 30).length,
      mlcCritical: onboard.filter(r => r.band === "critical").length,
      payroll: Math.round(onboard.reduce((s, r) => s + r.monthly, 0) * 100) / 100,
    },
    vessels: [...vessels.entries()].map(([name, crew]) => ({
      name, imo: meta.get(name)?.imo_number || "", flag: meta.get(name)?.flag_state || "", type: meta.get(name)?.vessel_type || "",
      crew: crew.sort((a, b) => (a.daysToRelief ?? 9999) - (b.daysToRelief ?? 9999)),
      onboard: crew.filter(c => c.state === "onboard").length,
      payroll: crew.reduce((s, c) => s + (c.state === "onboard" ? c.monthly : 0), 0),
      alerts: crew.filter(c => (c.daysToRelief !== null && c.daysToRelief <= 30) || c.band === "critical").length,
    })).sort((a, b) => b.alerts - a.alerts || b.onboard - a.onboard),
  };
}
