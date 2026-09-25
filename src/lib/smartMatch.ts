import type { UnifiedVacancy } from "@/lib/vacancyFeed";

/** Crew signals used to rank vacancies. All fields optional — matching degrades gracefully. */
export interface MatchProfile {
  rank?: string | null;
  preferredVessel?: string | null;
  nationality?: string | null;
}

export interface MatchResult {
  /** 0-100 compatibility score. */
  score: number;
  /** Short human reason, e.g. "Rank & vessel match". */
  reason: string;
  /** True when the vacancy is worth surfacing as a match. */
  isMatch: boolean;
}

const norm = (s?: string | null) => (s || "").toLowerCase().trim();

/** Common rank aliases seen in maritime postings. */
const RANK_ALIASES: Record<string, string[]> = {
  master: ["master", "captain", "capt", "mst"],
  "chief officer": ["chief officer", "chief mate", "c/o", "co", "1st officer", "first officer", "chief off"],
  "second officer": ["second officer", "2nd officer", "2/o", "second mate", "2nd mate"],
  "third officer": ["third officer", "3rd officer", "3/o", "third mate", "3rd mate"],
  bosun: ["bosun", "boatswain"],
  "able seaman": ["able seaman", "ab", "able bodied"],
  "ordinary seaman": ["ordinary seaman", "os"],
  "chief engineer": ["chief engineer", "c/e", "ce", "chief eng"],
  "second engineer": ["second engineer", "2nd engineer", "2/e", "first assistant engineer"],
  "third engineer": ["third engineer", "3rd engineer", "3/e"],
  "fourth engineer": ["fourth engineer", "4th engineer", "4/e"],
  eto: ["eto", "electro technical officer", "electrical officer", "eto officer"],
  fitter: ["fitter"],
  oiler: ["oiler", "motorman", "wiper"],
  cook: ["cook", "chief cook", "chef"],
  messman: ["messman", "steward", "mess man"],
  "deck cadet": ["deck cadet", "trainee deck", "cadet deck"],
  "engine cadet": ["engine cadet", "trainee engine", "cadet engine"],
};

/** Broad families used as a softer fallback when the exact rank differs. */
const FAMILIES: Record<string, string[]> = {
  deck: ["master", "captain", "officer", "mate", "bosun", "seaman", "deck", "ab", "os"],
  engine: ["engineer", "eto", "oiler", "motorman", "fitter", "electr", "engine", "wiper"],
  catering: ["cook", "chef", "steward", "messman"],
  cadet: ["cadet", "trainee"],
};

const canonicalRank = (raw?: string | null): string | null => {
  const r = norm(raw);
  if (!r) return null;
  for (const [key, aliases] of Object.entries(RANK_ALIASES)) {
    if (aliases.some((a) => r === a || r.includes(a))) return key;
  }
  return r;
};

const familyOf = (raw?: string | null): string | null => {
  const r = norm(raw);
  if (!r) return null;
  for (const [fam, keys] of Object.entries(FAMILIES)) {
    if (keys.some((k) => r.includes(k))) return fam;
  }
  return null;
};

const vesselMatches = (pref?: string | null, vessel?: string | null) => {
  const p = norm(pref);
  const v = norm(vessel);
  if (!p || p === "any type" || !v) return false;
  if (p === v) return true;
  const short = (s: string) => s.replace(/\s*(ship|carrier|vessel)\s*/g, "").trim();
  return short(p) === short(v) || v.includes(short(p)) || p.includes(short(v));
};

/** Score one vacancy against the crew profile. */
export const matchVacancy = (v: UnifiedVacancy, p: MatchProfile): MatchResult => {
  const crewRank = canonicalRank(p.rank);
  const jobRank = canonicalRank(v.rank);
  const anyRank = norm(v.rank).includes("any rank");

  let score = 0;
  const reasons: string[] = [];

  // Rank — 50
  if (crewRank && jobRank && crewRank === jobRank) {
    score += 50;
    reasons.push("Your rank");
  } else if (anyRank) {
    score += 28;
    reasons.push("Open to all ranks");
  } else {
    const cf = familyOf(p.rank);
    const jf = familyOf(v.rank);
    if (cf && jf && cf === jf) {
      score += 26;
      reasons.push(`${cf[0].toUpperCase()}${cf.slice(1)} department`);
    }
  }

  // Vessel — 25
  if (vesselMatches(p.preferredVessel, v.vessel)) {
    score += 25;
    reasons.push("Preferred vessel");
  } else if (!v.vessel || norm(p.preferredVessel) === "any type" || !p.preferredVessel) {
    score += 10;
  }

  // Nationality / region — 15
  const nat = norm(p.nationality);
  if (nat) {
    const hay = `${norm(v.port)} ${norm(v.notes)} ${norm(v.company)}`;
    if (hay.includes(nat)) {
      score += 15;
      reasons.push("Hiring in your region");
    }
  }

  // Direct verified postings apply fastest — 10
  if (v.kind === "direct") {
    score += 10;
    reasons.push("Direct from company");
  } else if (v.verified) {
    score += 5;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const isMatch = score >= 50;

  return { score, reason: reasons.slice(0, 2).join(" · ") || "Open vacancy", isMatch };
};

export interface RankedVacancy {
  vacancy: UnifiedVacancy;
  match: MatchResult;
}

/** Rank all vacancies best-first. Newer postings break ties. */
export const rankVacancies = (list: UnifiedVacancy[], p: MatchProfile): RankedVacancy[] =>
  list
    .map((vacancy) => ({ vacancy, match: matchVacancy(vacancy, p) }))
    .sort((a, b) => {
      if (b.match.score !== a.match.score) return b.match.score - a.match.score;
      const ta = a.vacancy.postedAt ? new Date(a.vacancy.postedAt).getTime() : 0;
      const tb = b.vacancy.postedAt ? new Date(b.vacancy.postedAt).getTime() : 0;
      return tb - ta;
    });

/** Only the vacancies worth calling a match. */
export const smartMatches = (list: UnifiedVacancy[], p: MatchProfile, limit = 10): RankedVacancy[] =>
  rankVacancies(list, p).filter((r) => r.match.isMatch).slice(0, limit);
