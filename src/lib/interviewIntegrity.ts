export type IntegrityState = "clean" | "restarted" | "locked";

export function integrityStatus(strikes: number | null | undefined): { state: IntegrityState; label: string; icon: string } {
  const n = Math.max(0, Number(strikes) || 0);
  if (n >= 3) return { state: "locked", label: "Locked", icon: "🔴" };
  if (n > 0) return { state: "restarted", label: "Restarted", icon: "⚠️" };
  return { state: "clean", label: "Clean", icon: "🛡️" };
}
