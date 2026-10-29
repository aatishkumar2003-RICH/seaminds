/** Admin manning matrix helpers: resolved nationality and live manning status. */
import { ORIGINS, originOf } from "@/lib/vacancyOrigin";

export interface ManningRow {
  nationality?: string | null; whatsapp_number?: string | null; email?: string | null;
  is_available?: boolean | null; availability_status?: string | null;
  placed_until?: string | null; available_from?: string | null;
}

export type ManningStatus = "ready" | "soon" | "onboard" | "unavailable";

export const STATUS_META: Record<ManningStatus, { label: string; color: string }> = {
  ready: { label: "Ready to join", color: "#22c55e" },
  soon: { label: "Available soon", color: "#f59e0b" },
  onboard: { label: "On board", color: "#60a5fa" },
  unavailable: { label: "Not available", color: "#94A3B8" },
};

const NAT_ALIASES: Record<string, string> = {
  indian: "India", filipino: "Philippines", indonesian: "Indonesia", vietnamese: "Vietnam",
  ukrainian: "Ukraine", russian: "Russia", chinese: "China", burmese: "Myanmar",
  bangladeshi: "Bangladesh", "sri lankan": "Sri Lanka", pakistani: "Pakistan", greek: "Greece",
  turkish: "Turkey", romanian: "Romania", polish: "Poland", croatian: "Croatia", german: "Germany",
  british: "United Kingdom", dutch: "Netherlands", "viet nam": "Vietnam", french: "France", egyptian: "Egypt", liberian: "Liberia", italian: "Italy", norwegian: "Norway", malaysian: "Malaysia", nigerian: "Nigeria", ghanaian: "Ghana", georgian: "Georgia",
};

/** Declared nationality first, then WhatsApp dial code, then email country domain. */
export const resolveNationality = (r: ManningRow): { name: string; flag: string; source: "declared" | "phone" | "email" | "none" } => {
  const raw = String(r.nationality || "").trim();
  if (raw) {
    const name = NAT_ALIASES[raw.toLowerCase()] || raw.replace(/\b\w/g, (c) => c.toUpperCase());
    const o = ORIGINS.find((x) => x.name.toLowerCase() === name.toLowerCase());
    return { name: o?.name || name, flag: o?.flag || "🏳️", source: "declared" };
  }
  const byPhone = originOf(r.whatsapp_number || null);
  if (byPhone) { const o = ORIGINS.find((x) => x.code === byPhone)!; return { name: o.name, flag: o.flag, source: "phone" }; }
  const byMail = originOf({ email: r.email || null });
  if (byMail) { const o = ORIGINS.find((x) => x.code === byMail)!; return { name: o.name, flag: o.flag, source: "email" }; }
  return { name: "Unknown", flag: "🏳️", source: "none" };
};

export const manningStatus = (r: ManningRow, now = new Date()): ManningStatus => {
  if ((r.placed_until && new Date(r.placed_until) > now) || r.availability_status === "joined") return "onboard";
  if (r.available_from && new Date(r.available_from) > now) return "soon";
  if (r.availability_status === "ready" || (r.is_available && r.availability_status !== "not_available")) return "ready";
  return "unavailable";
};
