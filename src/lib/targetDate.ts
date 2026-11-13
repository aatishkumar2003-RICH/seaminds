/** Target (complete-by) dates on interview and training invitations. Pure helpers. */
export const todayIso = (now = new Date()) => new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const fmtDue = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

/** done = finished before/after date doesn't matter; otherwise compare whole days. */
export function dueStatus(iso: string | null | undefined, done = false, now = new Date()): null | { label: string; color: string; key: "done" | "overdue" | "soon" | "ontrack" } {
  if (!iso) return null;
  if (done) return { key: "done", label: `Done · target ${fmtDue(iso)}`, color: "#22c55e" };
  const days = Math.round((new Date(`${iso.slice(0, 10)}T00:00:00`).getTime() - new Date(`${todayIso(now)}T00:00:00`).getTime()) / 86400000);
  if (days < 0) return { key: "overdue", label: `🔴 Overdue · ${fmtDue(iso)}`, color: "#ef4444" };
  if (days <= 1) return { key: "soon", label: `🟡 Due ${days === 0 ? "today" : "tomorrow"}`, color: "#f59e0b" };
  return { key: "ontrack", label: `🟢 Due ${fmtDue(iso)}`, color: "#22c55e" };
}

export type RangeKey = "any" | "today" | "week" | "month" | "custom";
/** Inclusive [from, to] ISO days for a preset; custom passes through. */
export function rangeFor(key: RangeKey, from = "", to = "", now = new Date()): { from: string | null; to: string | null } {
  const t = todayIso(now);
  if (key === "today") return { from: t, to: t };
  if (key === "week") return { from: todayIso(new Date(now.getTime() - 6 * 86400000)), to: t };
  if (key === "month") return { from: todayIso(new Date(now.getTime() - 29 * 86400000)), to: t };
  if (key === "custom") return { from: from || null, to: to || null };
  return { from: null, to: null };
}
export const inRange = (iso: string | null | undefined, r: { from: string | null; to: string | null }) =>
  (!r.from && !r.to) || (!!iso && (!r.from || iso.slice(0, 10) >= r.from) && (!r.to || iso.slice(0, 10) <= r.to));
