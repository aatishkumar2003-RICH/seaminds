export type DrillKey = "bulk" | "gas" | "container" | "tanker" | "reefer";

const VESSEL_TO_DRILL: Record<string, DrillKey> = {
  bulk: "bulk", general_cargo: "bulk", gas_carrier: "gas", container: "container",
  oil_tanker: "tanker", chemical_tanker: "tanker",
};

const KEYWORDS: [DrillKey, RegExp][] = [
  ["bulk", /liquef|imsbc|grain|hold|bauxite|hatch|draft survey|bulk/i],
  ["gas", /lng|lpg|boil.?off|bog|reliquef|cargo compressor|igc|sigtto|gas carrier/i],
  ["container", /lashing|stack|parametric|css code|container|imdg|bay plan/i],
  ["tanker", /inert gas|\bigs\b|deck seal|isgott|sire|cargo pump|tanker|crude|cow\b/i],
  ["reefer", /ammonia|refrigera|reefer|freon|controlled atmosphere/i],
];

/** Pick the fleet drill for one gap: keyword first, then the candidate's vessel type. */
export function drillForGap(gap: string, vessel?: string): DrillKey | null {
  for (const [key, re] of KEYWORDS) if (re.test(gap)) return key;
  return (vessel && VESSEL_TO_DRILL[vessel]) || null;
}

/** Ordered, de-duplicated drills prescribed from interview gaps. */
export function prescribeDrills(gaps: string[], vessel?: string): DrillKey[] {
  const out: DrillKey[] = [];
  for (const g of gaps) { const k = drillForGap(g, vessel); if (k && !out.includes(k)) out.push(k); }
  if (!out.length && vessel && VESSEL_TO_DRILL[vessel]) out.push(VESSEL_TO_DRILL[vessel]);
  return out;
}

export const drillLink = (k: DrillKey) => `/training?tab=drills&drill=${k}`;
