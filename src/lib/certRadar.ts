import { endDate } from "./seaContract";

export type RadarStatus = "expired" | "critical" | "warning" | "valid" | "no_expiry";
export type RadarCert = { name: string; number: string; expiry: string };
export type RadarCrew = { application_id: string; crew_name: string; rank: string; vessel: string | null; contract_start: string | null; contract_months: number | null; certs: RadarCert[] };
export type RadarRow = RadarCert & { crew: RadarCrew; status: RadarStatus; daysLeft: number | null; expiresMidContract: boolean };

const DAY = 86400000;
const toDate = (s: string) => { const m = /^(\d{4}-\d{2}-\d{2})/.exec(s || ""); return m ? m[1] : null; };

/** Expired (<0 days), critical (0–30), warning (31–90), valid (>90). Missing/unreadable date = no_expiry. */
export function classify(expiry: string, today: string): { status: RadarStatus; daysLeft: number | null } {
  const d = toDate(expiry);
  if (!d) return { status: "no_expiry", daysLeft: null };
  const days = Math.round((Date.parse(d + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / DAY);
  return { status: days < 0 ? "expired" : days <= 30 ? "critical" : days <= 90 ? "warning" : "valid", daysLeft: days };
}

/** True when a still-valid certificate runs out before the contract's planned end. */
export function expiresMidContract(expiry: string, start: string | null, months: number | null, today: string) {
  const d = toDate(expiry); const end = endDate(start, Number(months) || 0);
  return !!(d && end && d >= today && d < end);
}

export function buildRadar(crew: RadarCrew[], today: string): RadarRow[] {
  const order: Record<RadarStatus, number> = { expired: 0, critical: 1, warning: 2, valid: 3, no_expiry: 4 };
  return crew.flatMap(c => (c.certs || []).map(cert => {
    const { status, daysLeft } = classify(cert.expiry, today);
    return { ...cert, crew: c, status, daysLeft, expiresMidContract: expiresMidContract(cert.expiry, c.contract_start, c.contract_months, today) };
  })).sort((a, b) => order[a.status] - order[b.status] || (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9));
}

export function radarCounts(rows: RadarRow[]) {
  const out: Record<RadarStatus, number> = { expired: 0, critical: 0, warning: 0, valid: 0, no_expiry: 0 };
  rows.forEach(r => out[r.status]++);
  return out;
}
