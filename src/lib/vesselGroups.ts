/** Vessel-type groups for crew filtering (keyword match on vessel_type). */
export interface VesselGroup { slug: string; name: string; icon: string; keys: string[] }

export const VESSEL_GROUPS: VesselGroup[] = [
  { slug: "tug", name: "Tug & Barge", icon: "🚤", keys: ["tug", "barge", "towing", "harbour", "harbor", "pusher"] },
  { slug: "offshore", name: "Offshore", icon: "🏗️", keys: ["offshore", "osv", "ahts", "psv", "supply", "crew boat", "dp", "rig", "fpso", "utility"] },
  { slug: "gas", name: "Gas / LPG / LNG", icon: "🔥", keys: ["lpg", "lng", "gas"] },
  { slug: "tanker", name: "Tanker", icon: "🛢️", keys: ["tanker", "chemical", "oil", "product", "crude", "vlcc", "aframax", "suezmax", "bunker"] },
  { slug: "bulk", name: "Bulk Carrier", icon: "⛴️", keys: ["bulk", "capesize", "panamax", "supramax", "handysize", "ore", "cement"] },
  { slug: "container", name: "Container", icon: "📦", keys: ["container", "feeder"] },
  { slug: "general", name: "General Cargo", icon: "🚢", keys: ["general cargo", "multipurpose", "mpp", "heavy lift", "reefer", "ro-ro", "roro", "car carrier", "pctc", "landing craft", "lct"] },
  { slug: "passenger", name: "Passenger / Cruise", icon: "🛳️", keys: ["cruise", "passenger", "ferry", "yacht"] },
  { slug: "dredger", name: "Dredger", icon: "⚙️", keys: ["dredg", "hopper"] },
];

export const vesselGroupBySlug = (s: string | null | undefined) =>
  VESSEL_GROUPS.find((g) => g.slug === (s || "").toLowerCase()) || null;

/** A vacancy with several vessel types can belong to several groups. */
export const vesselMatches = (g: VesselGroup, vessel: string | null | undefined): boolean => {
  const v = (vessel || "").toLowerCase();
  if (!v) return false;
  if (g.slug === "tanker" && /\b(lpg|lng|gas)\b/.test(v) && !/tanker|chemical|oil|product|crude/.test(v)) return false;
  return g.keys.some((k) => (k.length <= 3 ? new RegExp(`(^|[^a-z])${k}([^a-z]|$)`).test(v) : v.includes(k)));
};
