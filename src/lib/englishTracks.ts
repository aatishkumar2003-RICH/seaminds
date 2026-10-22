import { SCENARIOS, pickVariant, type Dept, type Scenario } from "@/lib/maritimeEnglish";

/** Rank pools follow STCW/IMO Model Course 3.17: general safety for all + specialised by department. */
export const RANK_POOLS: Record<Exclude<Dept, "all">, string[]> = {
  deck: ["vhf-tss", "vhf-crossing", "vhf-pilot", "vhf-anchor", "safe-mob", "safe-mayday", "psc-enclosed", "psc-drill", "safe-fire"],
  engine: ["eng-handover", "eng-alarm", "eng-bunker", "eng-sounding", "safe-fire", "psc-ows", "psc-enclosed", "psc-drill", "safe-mayday"],
  rating: ["rat-helm", "rat-lookout", "rat-mooring", "rat-gangway", "safe-fire", "safe-mob", "psc-drill", "psc-enclosed", "eng-sounding"],
};
export const poolFor = (dept: Dept) => RANK_POOLS[dept === "all" ? "deck" : dept];

export type TrackId = "1d" | "3d" | "7d";
export interface TrackDay { title: string; lessons: string[] }
export interface Track { id: TrackId; label: string; icon: string; who: string; days: TrackDay[] }

const DAY_TITLES_3 = ["Watchkeeping & communication", "Safety & operations", "Inspection & arrival"];
const DAY_TITLES_7 = ["Radio basics", "Watch reports", "Safety alarms", "Operations", "Emergencies", "Inspection prep"];

/** Tracks are built from the crew's own rank pool (9 lessons). The exam is always open. */
export function tracksFor(dept: Dept): Track[] {
  const p = poolFor(dept);
  return [
    { id: "1d", label: "1-Day Crash", icon: "⚡", who: "Joining in 1–2 days · ~15 min", days: [{ title: "Essentials before you join", lessons: p.slice(0, 4) }] },
    { id: "3d", label: "3-Day Pre-Joining", icon: "🎯", who: "Joining this week · ~8 min/day", days: [0, 1, 2].map((i) => ({ title: DAY_TITLES_3[i], lessons: p.slice(i * 3, i * 3 + 3) })) },
    { id: "7d", label: "7-Day Mastery", icon: "🏆", who: "Build confidence · ~5 min/day", days: [[0, 2], [2, 4], [4, 6], [6, 7], [7, 8], [8, 9]].map(([a, b], i) => ({ title: DAY_TITLES_7[i], lessons: p.slice(a, b) })) },
  ];
}

export const PASS_MARK = 75;
export const EXAM_SIZE = 3;

/**
 * Adaptive exam: 3 questions from the crew's rank pool.
 * - Untried / weakest lessons are tested first (finds real gaps).
 * - Strong candidates (avg ≥ 80) get harder task types (Explain / Respond) first.
 * - Every attempt randomises the order and the numbers/ship names via variants.
 */
export function buildExam(dept: Dept, best: Record<string, number>, rnd = Math.random): Scenario[] {
  const pool = poolFor(dept).map((id) => SCENARIOS.find((s) => s.id === id)!).filter(Boolean);
  const tried = Object.entries(best).filter(([id]) => pool.some((s) => s.id === id)).map(([, v]) => v);
  const avg = tried.length ? tried.reduce((a, b) => a + b, 0) / tried.length : 0;
  const hard = (s: Scenario) => (s.task === "Explain" || s.task === "Respond" ? 1 : 0);
  const ranked = pool
    .map((s) => ({ s, k: (best[s.id] ?? -1) + (avg >= 80 ? -40 * hard(s) : 0) + rnd() * 30 }))
    .sort((a, b) => a.k - b.k)
    .slice(0, EXAM_SIZE)
    .map((x) => pickVariant(x.s, rnd));
  return ranked;
}

export interface ExamResult { trackId: TrackId; score: number; passed: boolean; date: string; weak: string[] }
export function gradeExam(trackId: TrackId, items: { sc: Scenario; score: number }[], date = new Date().toISOString()): ExamResult {
  const score = items.length ? Math.round(items.reduce((n, i) => n + i.score, 0) / items.length) : 0;
  return { trackId, score, passed: score >= PASS_MARK, date, weak: items.filter((i) => i.score < PASS_MARK).map((i) => i.sc.id) };
}

const KEY = "sm_eng_tracks_v1";
export interface TrackState { active: TrackId | null; exams: ExamResult[] }
export const loadTracks = (): TrackState => { try { return { active: null, exams: [], ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { active: null, exams: [] }; } };
export const saveTracks = (s: TrackState) => localStorage.setItem(KEY, JSON.stringify(s));
export const bestExam = (s: TrackState, id: TrackId) => s.exams.filter((e) => e.trackId === id).sort((a, b) => b.score - a.score)[0];

export const shareText = (r: ExamResult, track: Track, origin = "https://seaminds.life") =>
  `My SeaMinds Maritime English result — ${track.label}: ${r.score}% (${r.passed ? "PASSED" : "in progress"}). Practice based on IMO SMCP. ${origin}/training?tab=english`;
