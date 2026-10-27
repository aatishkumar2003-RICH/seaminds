// SeaMinds Maritime Brain — Phase 1 knowledge cores (pure, no imports; vitest-testable).
// Deck/Master + Engine/ETO specialist brains on a shared safety & regulatory foundation.
// Topics are syllabus anchors, NOT operational figures: the AI must defer exact limits to
// current rule text, flag/class requirements, company SMS and the vessel's maker manuals.

export type Department = "deck" | "engine";
export type BrainMode = "interview" | "training" | "guidance";
export type Level = "support" | "operational" | "management";

export interface Topic { id: string; title: string; dept: Department | "shared"; points: string[]; vessels?: string[] }
export interface SafetyGate { id: string; title: string; triggers: string[]; mustMention: string[]; sources: string[] }

export const BRAIN_VERSION = "2026.1-phase1";

export const VESSEL_TYPES = ["bulk", "oil_tanker", "chemical_tanker", "gas_carrier", "container", "general_cargo", "ro_ro", "offshore", "passenger"] as const;
export type VesselType = typeof VESSEL_TYPES[number];

export const ENGINE_TOPICS: Topic[] = [
  { id: "me_2stroke", title: "Main engine 2-stroke (MC/ME-C, RT-flex/X)", dept: "engine", points: ["combustion & exhaust temperature diagnosis", "fuel injection, exhaust valve actuation, electronic control", "scavenge space inspection, scavenge fire", "piston/liner/ring condition, decarbonisation procedure", "starting air system & failure to start", "cylinder lube oil feed rate and BN matching"] },
  { id: "running_gear", title: "Running gear & alignment", dept: "engine", points: ["crankshaft web deflections, hot/cold readings", "main/crosshead/crankpin bearing clearances", "tie rods, thrust bearing, oil mist detector", "crankcase explosion prevention & relief valves"] },
  { id: "dual_fuel", title: "Dual-fuel & future fuels", dept: "engine", points: ["ME-GI/ME-GA/ME-LGIM, X-DF principles", "FGSS, double-wall piping, gas detection, inert purging", "LNG, methanol, ammonia and hydrogen toxicity/flammability hazards", "IGF Code obligations"] },
  { id: "aux_engines", title: "Auxiliary engines & power generation", dept: "engine", points: ["4-stroke generator overhaul, valve clearances, fuel timing", "turbocharger surging, governor hunting", "load sharing, synchronising, reverse power", "lube oil analysis trends"] },
  { id: "electrical", title: "Electrical, switchboards & high voltage", dept: "engine", points: ["MSB/ESB layout, bus-tie, preferential trips", "AVR, reactive load sharing, insulation monitoring/earth faults", "shaft generator PTO/PTI, frequency converters", "HV switching, earthing, interlocks, LOTO, permit to work", "blackout recovery and dead-ship start"] },
  { id: "emergency_power", title: "Emergency generator & emergency fire pump", dept: "engine", points: ["SOLAS II-1 emergency source: independence, auto-start/connection, duration", "emergency fire pump capacity, suction lift, priming, independent drive", "routine testing & records"] },
  { id: "boilers", title: "Boilers & steam", dept: "engine", points: ["auxiliary/composite boiler operation and flame failure trips", "water chemistry: alkalinity, chlorides, phosphate, oxygen scavenger", "gauge glass blow-through, safety valve setting", "soot fire in exhaust gas economiser"] },
  { id: "purifiers", title: "Fuel/oil treatment & purifiers", dept: "engine", points: ["purifier vs clarifier, gravity disc / interface control", "bowl sealing water, desludging, overflow faults", "cat fines, viscosity control, fuel changeover for ECAs", "bunkering procedures & sampling"] },
  { id: "pollution", title: "Pollution prevention plant", dept: "engine", points: ["OWS & 15 ppm monitor, Oil Record Book", "sewage treatment, FWG & salinometer", "BWMS (D-2), incinerator, garbage management", "SOx scrubbers, SCR/EGR Tier III"] },
  { id: "aux_systems", title: "Auxiliary machinery", dept: "engine", points: ["steering gear (hydraulics, tests, emergency steering)", "compressors, refrigeration & AC", "fixed fire-fighting (CO2, water mist) maintenance", "pumps, valves, heat exchangers"] },
  { id: "automation", title: "Automation, UMS & cyber", dept: "engine", points: ["alarm & monitoring, UMS requirements", "PLC/control loops, sensor faults", "IACS UR E26/E27 and cyber hygiene"] },
  { id: "eng_management", title: "Engine management", dept: "engine", points: ["PMS & condition monitoring, spares planning", "class surveys, CoC, dry-dock specification", "budget, superintendent reporting, CII/EEXI technical measures", "MLC rest hours, ER team leadership"] },
];

export const DECK_TOPICS: Topic[] = [
  { id: "navigation", title: "Navigation & passage planning", dept: "deck", points: ["appraisal–planning–execution–monitoring", "ECDIS: safety contour/depth, CATZOC, alarms, updates", "radar/ARPA, GNSS errors & spoofing cross-checks", "gyro & magnetic compass error determination", "squat, UKC, restricted waters, PSSA/ECA"] },
  { id: "colregs", title: "COLREGs & bridge team management", dept: "deck", points: ["rules application in restricted visibility & close quarters", "BRM, pilot integration, master's standing orders", "watch handover, fatigue"] },
  { id: "gmdss", title: "GMDSS & communications", dept: "deck", points: ["DSC distress/urgency/safety procedures", "EPIRB/SART/AIS-SART testing and HRU", "NAVTEX, Inmarsat/Iridium, reserve source of energy", "logbook & periodic test records"] },
  { id: "stability", title: "Stability & hull strength", dept: "deck", points: ["intact stability criteria, GM, free surface", "damage stability, watertight integrity & doors", "shear force & bending moment, loading computer", "grain heeling moments (Grain Code)", "draft survey"] },
  { id: "cargo_bulk", title: "Dry bulk cargo", dept: "deck", vessels: ["bulk", "general_cargo"], points: ["IMSBC: Group A liquefaction, TML/MC, can test", "BLU Code, loading/de-ballasting sequence", "hold cleanliness, hatch cover weathertightness"] },
  { id: "cargo_tanker", title: "Tanker cargo operations", dept: "deck", vessels: ["oil_tanker", "chemical_tanker"], points: ["ISGOTT, inert gas, COW, VEC", "IBC Code, compatibility, wall wash, tank cleaning", "ODME, P&A Manual, Cargo Record Book"] },
  { id: "cargo_gas", title: "Gas carrier operations", dept: "deck", vessels: ["gas_carrier"], points: ["IGC Code, cool-down/warm-up, inerting/gassing-up", "BOG management, reliquefaction, ESD testing"] },
  { id: "cargo_container", title: "Container & ro-ro", dept: "deck", vessels: ["container", "ro_ro"], points: ["Cargo Securing Manual, lashing, VGM", "dangerous goods (IMDG) segregation", "parametric/synchronous rolling avoidance"] },
  { id: "mooring", title: "Mooring & anchoring", dept: "deck", points: ["OCIMF MEG4: LDBF, WLL, line management plan", "snap-back hazard awareness", "windlass brake testing, anchoring and dragging"] },
  { id: "lsa_ffa", title: "LSA / FFA", dept: "deck", points: ["lifeboat on-load release, FPDs, drills", "rescue boat launch & recovery", "fixed CO2 release procedures", "SCBA, EEBD, fire detection & drills"] },
  { id: "deck_management", title: "Deck management & vetting", dept: "deck", points: ["ISM/SMS, near-miss & root cause", "SIRE 2.0 (process/hardware/human), RightShip", "PSC readiness, CICs", "ISPS, MARPOL Annex V garbage, MLC compliance"] },
];

export const SAFETY_GATES: SafetyGate[] = [
  { id: "enclosed_space", title: "Enclosed space entry", triggers: ["enclosed", "tank entry", "cargo hold", "void space", "ballast tank", "pump room"], mustMention: ["permit to work", "ventilation", "atmosphere testing (O2, flammable, toxic)", "standby person & rescue arrangements", "competent/authorised entrants only per SMS"], sources: ["SOLAS XI-1/7", "IMO Res. A.1050(27)", "company SMS"] },
  { id: "hot_work", title: "Hot work", triggers: ["weld", "cutting", "grinding", "hot work"], mustMention: ["hot work permit", "gas-free & atmosphere check", "fire watch & extinguishing ready", "adjacent space checks"], sources: ["ISGOTT", "company SMS"] },
  { id: "electrical_isolation", title: "Electrical isolation / LOTO", triggers: ["busbar", "switchboard", "high voltage", "breaker", "hv", "isolation"], mustMention: ["isolation & lock-out/tag-out", "prove dead", "earthing for HV", "permit & competent person"], sources: ["IEC 60092", "company SMS"] },
  { id: "machinery_fire", title: "Machinery fire / scavenge & crankcase", triggers: ["scavenge fire", "crankcase", "oil mist", "explosion"], mustMention: ["stop/slow per maker manual", "do NOT open doors/covers until cooled", "fuel cut-off & boundary cooling", "inform bridge/master"], sources: ["SOLAS II-2", "maker manual"] },
  { id: "blackout", title: "Blackout / loss of propulsion", triggers: ["blackout", "dead ship", "loss of power", "loss of propulsion"], mustMention: ["inform bridge", "emergency source on load", "restoration sequence per SMS", "navigational safety (NUC signals)"], sources: ["SOLAS II-1", "company SMS"] },
  { id: "mooring_safety", title: "Mooring operations", triggers: ["mooring", "snap-back", "line parted", "winch"], mustMention: ["stay out of snap-back zones", "line condition & WLL", "communication & supervision"], sources: ["OCIMF MEG4", "COSWP"] },
  { id: "pollution", title: "Pollution / discharge", triggers: ["discharge", "overboard", "oil spill", "bilge"], mustMention: ["MARPOL limits & record books", "SOPEP/SMPEP reporting", "never bypass monitoring equipment"], sources: ["MARPOL Annexes I–VI"] },
  { id: "rest_fatigue", title: "Rest hours & fatigue", triggers: ["rest hours", "fatigue", "overtime", "tired"], mustMention: ["MLC/STCW rest hour minimums", "accurate recording"], sources: ["MLC 2006 A2.3", "STCW VIII/1"] },
];

export const RANK_LEVELS: Record<string, { dept: Department; level: Level }> = {
  master: { dept: "deck", level: "management" }, chief_officer: { dept: "deck", level: "management" },
  second_officer: { dept: "deck", level: "operational" }, third_officer: { dept: "deck", level: "operational" },
  deck_cadet: { dept: "deck", level: "support" }, bosun: { dept: "deck", level: "support" }, ab: { dept: "deck", level: "support" },
  chief_engineer: { dept: "engine", level: "management" }, second_engineer: { dept: "engine", level: "management" },
  third_engineer: { dept: "engine", level: "operational" }, fourth_engineer: { dept: "engine", level: "operational" },
  eto: { dept: "engine", level: "operational" }, engine_cadet: { dept: "engine", level: "support" }, oiler: { dept: "engine", level: "support" },
};

const RANK_ALIASES: [RegExp, string][] = [
  [/^(master|captain|capt)/, "master"], [/(chief off|c\/o|chief mate|1st off|first off)/, "chief_officer"],
  [/(2nd off|2\/o|second off|2nd mate)/, "second_officer"], [/(3rd off|3\/o|third off|3rd mate)/, "third_officer"],
  [/deck cadet/, "deck_cadet"], [/(bosun|boatswain)/, "bosun"], [/(^ab$|able sea)/, "ab"],
  [/(chief eng|c\/e)/, "chief_engineer"], [/(2nd eng|2\/e|second eng)/, "second_engineer"],
  [/(3rd eng|3\/e|third eng)/, "third_engineer"], [/(4th eng|4\/e|fourth eng|junior eng)/, "fourth_engineer"],
  [/(eto|electro|electrical off)/, "eto"], [/engine cadet/, "engine_cadet"], [/(oiler|motorman|wiper)/, "oiler"],
];

export function resolveRank(raw: string): string | null {
  const s = (raw || "").toLowerCase().trim();
  if (RANK_LEVELS[s]) return s;
  for (const [re, id] of RANK_ALIASES) if (re.test(s)) return id;
  return null;
}

export function topicsFor(rank: string, vessel?: VesselType): Topic[] {
  const r = RANK_LEVELS[rank];
  if (!r) return [];
  const pool = r.dept === "deck" ? DECK_TOPICS : ENGINE_TOPICS;
  return pool.filter((t) => {
    if (t.vessels && vessel && !t.vessels.includes(vessel)) return false;
    if (r.level !== "management" && /management/.test(t.id)) return false;
    if (r.level === "support" && ["dual_fuel", "automation", "stability", "cargo_gas"].includes(t.id)) return false;
    return true;
  });
}

export function detectSafetyGates(text: string): SafetyGate[] {
  const s = (text || "").toLowerCase();
  return SAFETY_GATES.filter((g) => g.triggers.some((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\b`).test(s)));
}

export interface BrainContext { rank: string; targetRank?: string; vessel?: VesselType; mode: BrainMode; language?: string; userText?: string }

export function buildBrainPrompt(ctx: BrainContext): string {
  const rank = resolveRank(ctx.rank) ?? "unknown";
  const target = ctx.targetRank ? resolveRank(ctx.targetRank) ?? ctx.targetRank : null;
  const focusRank = target && RANK_LEVELS[target] ? target : rank;
  const info = RANK_LEVELS[focusRank];
  const topics = topicsFor(focusRank, ctx.vessel);
  const gates = detectSafetyGates(ctx.userText ?? "");
  const brain = info?.dept === "engine" ? "Engine & ETO specialist (Chief Engineer level)" : "Deck & Master specialist (Master Mariner level)";
  const modeRules: Record<BrainMode, string> = {
    interview: "Ask ONE scenario question at a time, adapted to the previous answer. Escalate when strong; step down to locate the gap when weak or silent. Never reveal model answers during the interview. Any unsafe action is a critical flag: stop, state the hazard, and test recovery.",
    training: "Coach step by step: explain the why, give a short scenario, check understanding, then summarise the gap closed.",
    guidance: "Give structured troubleshooting: likely causes ranked, checks in safe order, then rectification. Say clearly what must be verified in the maker manual or by the superintendent.",
  };
  return [
    `You are the SeaMinds Maritime Brain (${BRAIN_VERSION}) acting as ${brain}.`,
    `Candidate rank: ${rank}${target ? `; target rank: ${target}` : ""}${ctx.vessel ? `; vessel: ${ctx.vessel}` : ""}. Level: ${info?.level ?? "unknown"}.`,
    `Mode: ${ctx.mode}. ${modeRules[ctx.mode]}`,
    `Syllabus focus:\n${topics.map((t) => `- ${t.title}: ${t.points.join("; ")}`).join("\n")}`,
    `Mandatory dual-pillar answers: every technical answer ends with a "Safety & compliance" section (relevant SOLAS, MARPOL, STCW, MLC, ISM/SMS, ISGOTT, IMSBC, MEG4, SIRE 2.0 points). Never suggest bypassing alarms, trips, interlocks, permits or monitoring equipment.`,
    gates.length ? `Safety gates triggered — you MUST cover:\n${gates.map((g) => `- ${g.title}: ${g.mustMention.join("; ")} (ref: ${g.sources.join(", ")})`).join("\n")}` : "",
    `Accuracy: do not invent numeric limits, part numbers or maker procedures. If unsure, say which document (current rule text, class rules, flag requirements, company SMS, maker manual) must be checked. Rules change — state that latest amendments must be confirmed.`,
    `Language: reply in ${ctx.language ? ctx.language : "the language the seafarer writes in"}; keep technical terms in standard Maritime English (IMO SMCP) in brackets where helpful.`,
    `Privacy: never request or reveal wellness, medical or other crew's personal data.`,
  ].filter(Boolean).join("\n\n");
}
