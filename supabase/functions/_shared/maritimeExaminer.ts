// Phase 2 — adaptive examiner logic (pure, no imports besides the brain; vitest-testable).
import { buildBrainPrompt, detectSafetyGates, resolveRank, VESSEL_TYPES, type VesselType } from "./maritimeBrain.ts";

// Adaptive length: early mastery exit at 12, standard close at 25, deep diagnostic up to 40 (≈15–50 min).
export const MIN_TURNS = 12;
export const STANDARD_TURNS = 25;
export const MAX_TURNS = 40;
export const MIN_FINISH_TURNS = 10;   // candidate may choose to finish after this many answers
export const MASTERY_PCT = 80;
export const STANDARD_PCT = 65;

export const PILLARS = {
  engine: ["main_propulsion", "aux_power_electrical", "aux_machinery", "safety_pollution", "paperwork_sms"],
  deck: ["navigation_colregs", "cargo_stability", "bridge_team_ecdis", "safety_security", "paperwork_sms"],
} as const;
export const departmentOf = (rank: string): "engine" | "deck" =>
  /(engineer|eto|oiler|engine_cadet)/.test(resolveRank(rank) ?? "") ? "engine" : "deck";
/** Every 4th question (4, 8, 12…) is a quick-decision pickup with options A–D. */
export const isPickup = (turnIndex: number) => turnIndex > 0 && turnIndex % 4 === 3;
export const MAX_ANSWER_CHARS = 2000;

export type Phase = "baseline" | "troubleshooting" | "safety" | "leadership";
export interface Turn { question: string; answer: string; phase?: Phase; depth?: number; safety_flag?: boolean; gap?: string | null; topic?: string; pillar?: string }
export interface ExamInput { rank: string; targetRank?: string; vessel?: string; language?: string; turns: Turn[]; answer?: string }

export interface Assessment { topic: string; depth: number; safety_flag: boolean; gap: string | null; feedback: string; pillar?: string }
export interface ExamStep { assessment: Assessment | null; next_question: string | null; phase: Phase | null; done: boolean }

export function phaseFor(turnIndex: number): Phase {
  if (turnIndex < 2) return "baseline";
  if (turnIndex < 4) return "troubleshooting";
  if (turnIndex < 6) return "safety";
  return "leadership";
}

/** Per-pillar coverage of answered turns. */
export function pillarStats(turns: Turn[]) {
  const m: Record<string, { n: number; sum: number }> = {};
  for (const t of turns) if (typeof t.depth === "number" && t.pillar) { (m[t.pillar] ??= { n: 0, sum: 0 }); m[t.pillar].n++; m[t.pillar].sum += t.depth; }
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { n: v.n, pct: Math.round((v.sum / (v.n * 4)) * 100) }]));
}

/** Ability-first routing: pick the least-tested pillar, skipping one the candidate just struggled on. */
export function nextPillar(turns: Turn[], dept: "engine" | "deck"): string {
  const stats = pillarStats(turns);
  const last = turns[turns.length - 1];
  const weakLast = last && typeof last.depth === "number" && last.depth <= 1 ? last.pillar : undefined;
  const pool = PILLARS[dept].filter((p) => p !== weakLast);
  return [...pool].sort((a, b) => (stats[a]?.n ?? 0) - (stats[b]?.n ?? 0))[0];
}

export type StopReason = "mastery" | "standard" | "max" | null;
/** Adaptive exit gates. ≥80% with no safety flag after 12 (all pillars seen) ends early; ≥65% after 25; hard cap 40. */
export function examDecision(turns: Turn[], dept: "engine" | "deck" = "engine"): StopReason {
  const n = turns.length;
  if (n >= MAX_TURNS) return "max";
  const { technical_pct, safety_flags } = summarise(turns);
  const covered = PILLARS[dept].filter((p) => pillarStats(turns)[p]).length;
  if (n >= MIN_TURNS && technical_pct >= MASTERY_PCT && safety_flags === 0 && covered >= 4) return "mastery";
  if (n >= STANDARD_TURNS && technical_pct >= STANDARD_PCT && safety_flags <= 1) return "standard";
  return null;
}

export function validateInput(raw: unknown): { ok: true; value: ExamInput } | { ok: false; error: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const rank = typeof b.rank === "string" ? b.rank.slice(0, 60) : "";
  if (!resolveRank(rank)) return { ok: false, error: "unknown_rank" };
  const targetRank = typeof b.targetRank === "string" && b.targetRank ? b.targetRank.slice(0, 60) : undefined;
  if (targetRank && !resolveRank(targetRank)) return { ok: false, error: "unknown_target_rank" };
  const vessel = typeof b.vessel === "string" && (VESSEL_TYPES as readonly string[]).includes(b.vessel) ? b.vessel : undefined;
  const language = typeof b.language === "string" ? b.language.slice(0, 30) : undefined;
  const turnsRaw = Array.isArray(b.turns) ? b.turns : [];
  if (turnsRaw.length > MAX_TURNS) return { ok: false, error: "too_many_turns" };
  const turns: Turn[] = turnsRaw.map((t: any) => ({
    question: String(t?.question ?? "").slice(0, 1500),
    answer: String(t?.answer ?? "").slice(0, MAX_ANSWER_CHARS),
  }));
  const answer = typeof b.answer === "string" ? b.answer.slice(0, MAX_ANSWER_CHARS).trim() : undefined;
  return { ok: true, value: { rank, targetRank, vessel, language, turns, answer } };
}

/** Builds chat messages: brain system prompt + examiner protocol + transcript. */
export function buildExamMessages(input: ExamInput, pendingQuestion: string | null, seed = 0) {
  const turnIndex = input.turns.length + (pendingQuestion ? 1 : 0);
  const userText = [...input.turns.map((t) => t.answer), input.answer ?? ""].join(" ");
  const system = buildBrainPrompt({
    rank: input.rank, targetRank: input.targetRank, vessel: input.vessel as VesselType | undefined,
    mode: "interview", language: input.language, userText,
  });
  const nextPhase = phaseFor(turnIndex);
  const dept = departmentOf(input.rank);
  const known = input.turns.map((t) => ({ ...t }));
  const pillar = nextPillar(known, dept);
  const pickup = isPickup(turnIndex);
  const protocol = [
    `Examiner protocol: you are a senior superintendent running an oral (viva voce) board. One realistic shipboard question per turn, max 90 words. Assess ABILITIES, not disabilities: find what the candidate CAN do.`,
    turnIndex <= 1 ? `Opening: first learn the candidate's last vessel, machinery/cargo, PSC findings and duties, then anchor later questions to that experience.` : `Anchor questions to the vessel and equipment the candidate described earlier when relevant.`,
    `Responsibility pillars for this ${dept} rank: ${PILLARS[dept].join(", ")}. Include rank duties, statutory paperwork and SMS records, not only troubleshooting.`,
    `Next question pillar: ${pillar}. Next phase: ${nextPhase}.`,
    pickup
      ? `This turn is a QUICK-DECISION PICKUP: give a short emergency/priority scenario then exactly 4 options on separate lines formatted "A) …", "B) …", "C) …", "D) …". Ask the candidate to pick the best FIRST action and give a one-line reason. Exactly one option is clearly best.`
      : `This turn is ORAL: open question answered in the candidate's own words.`,
    `If the last answer was strong (depth ≥3) go deeper on edge cases; if weak or "don't know" (depth ≤1) do NOT keep drilling it — move to a different pillar to find the candidate's strengths. Never repeat a question. Vary scenarios (variation key ${seed % 997}).`,
    `If the last answer proposed an unsafe action, set safety_flag true, name the hazard in feedback, and make the next question test recovery.`,
    `depth scale: 0 no answer, 1 unsafe/incorrect, 2 partial, 3 competent, 4 expert.`,
    turnIndex >= MAX_TURNS ? `This is the final answer: set next_question to null.` : "",
    `For a pickup answer, judge the chosen option and the reason; wrong option = depth ≤1.`,
    `Return ONLY JSON: {"assessment": {"topic": string, "pillar": one of [${PILLARS[dept].join(", ")}], "depth": 0-4, "safety_flag": boolean, "gap": string|null, "feedback": string} | null, "next_question": string|null}. assessment is null when there is no answer to assess. The assessment pillar is the pillar of the question just answered.`,
  ].filter(Boolean).join("\n");
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [{ role: "system", content: `${system}\n\n${protocol}` }];
  for (const t of input.turns) {
    messages.push({ role: "assistant", content: t.question });
    messages.push({ role: "user", content: t.answer || "(no answer)" });
  }
  if (pendingQuestion) {
    messages.push({ role: "assistant", content: pendingQuestion });
    messages.push({ role: "user", content: input.answer || "(no answer)" });
  } else {
    messages.push({ role: "user", content: "Start the interview with a brief greeting and the first question." });
  }
  return { messages, nextPhase, turnIndex, dept };
}

/** Validates AI JSON and applies deterministic safety rules on top of it. */
export function finalizeStep(aiRaw: unknown, answer: string | undefined, turnIndex: number, prior?: { turns: Turn[]; question: string; dept: "engine" | "deck" }): ExamStep {
  const o = (aiRaw ?? {}) as any;
  let assessment: Assessment | null = null;
  if (answer !== undefined) {
    const a = o.assessment ?? {};
    const blank = !answer || /^(i don'?t know|dont know|no idea|pass|skip|-)$/i.test(answer.trim());
    let depth = Math.max(0, Math.min(4, Math.round(Number(a.depth) || 0)));
    if (blank) depth = 0;
    let safety = a.safety_flag === true;
    // Deterministic net: a safety-gate scenario answered without any core precaution is flagged.
    const gates = detectSafetyGates(answer);
    if (!blank && gates.length && !/(permit|isolat|ventilat|gas test|test the atmosphere|lock|tag|standby|inform|stop)/i.test(answer)) safety = true;
    if (safety) depth = Math.min(depth, 1);
    assessment = {
      topic: String(a.topic ?? "general").slice(0, 80),
      depth, safety_flag: safety,
      gap: blank ? "No answer given" : (a.gap ? String(a.gap).slice(0, 200) : null),
      feedback: String(a.feedback ?? "").slice(0, 400),
    };
    const allowed = prior ? (PILLARS[prior.dept] as readonly string[]) : [...PILLARS.engine, ...PILLARS.deck];
    if (typeof a.pillar === "string" && allowed.includes(a.pillar)) assessment.pillar = a.pillar;
  }
  const stop = prior && assessment ? examDecision([...prior.turns, { question: prior.question, answer: answer ?? "", ...assessment }], prior.dept) : null;
  const done = turnIndex >= MAX_TURNS || !!stop;
  const q = !done && typeof o.next_question === "string" && o.next_question.trim() ? o.next_question.trim().slice(0, 900) : null;
  return { assessment, next_question: q, phase: q ? phaseFor(turnIndex) : null, done: done || !q };
}

export type Verdict = "ready" | "ready_with_training" | "not_ready";
export function summarise(turns: Turn[]): { technical_pct: number; safety_flags: number; gaps: string[]; verdict: Verdict; strengths: string[] } {
  const scored = turns.filter((t) => typeof t.depth === "number");
  const technical_pct = scored.length ? Math.round((scored.reduce((s, t) => s + (t.depth as number), 0) / (scored.length * 4)) * 100) : 0;
  const safety_flags = scored.filter((t) => t.safety_flag).length;
  const gaps = [...new Set(scored.map((t) => t.gap).filter((g): g is string => !!g))];
  const verdict: Verdict = safety_flags >= 2 || technical_pct < 50 ? "not_ready" : safety_flags === 1 || technical_pct < 75 ? "ready_with_training" : "ready";
  const strengths = Object.entries(pillarStats(scored)).filter(([, v]) => v.pct >= 75).map(([k]) => k);
  return { technical_pct, safety_flags, gaps, verdict, strengths };
}
