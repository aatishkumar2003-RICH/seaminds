// Phase 2 — adaptive examiner logic (pure, no imports besides the brain; vitest-testable).
import { buildBrainPrompt, detectSafetyGates, resolveRank, VESSEL_TYPES, type Department, type VesselType } from "./maritimeBrain.ts";

// Legacy adaptive interviews remain resumable. New interviews use the fixed four-part framework below.
export const MIN_TURNS = 12;
export const STANDARD_TURNS = 25;
export const MAX_TURNS = 40;
export const MIN_FINISH_TURNS = 10;
export const MASTERY_PCT = 80;
export const STANDARD_PCT = 65;
export const FOUR_PART_FRAMEWORK = "four_in_one_v1" as const;
export const FOUR_PART_TURNS = 14;
export type InterviewFramework = "adaptive_v1" | typeof FOUR_PART_FRAMEWORK;
export type InterviewModule = "spoken_english" | "technical" | "writing" | "composure";
export type TechnicalStage = "immediate" | "investigation" | "resolution";

export const PILLARS = {
  engine: ["main_propulsion", "aux_power_electrical", "aux_machinery", "safety_pollution", "paperwork_sms"],
  deck: ["navigation_colregs", "cargo_stability", "bridge_team_ecdis", "safety_security", "paperwork_sms"],
  catering: ["galley_safety", "food_hygiene", "provisions_dietary", "teamwork_service", "paperwork_sms"],
} as const;
export const departmentOf = (rank: string): Department => {
  const r = resolveRank(rank) ?? "";
  if (/(cook|steward|messman)/.test(r)) return "catering";
  return /(engineer|eto|oiler|fitter|wiper|engine_cadet)/.test(r) ? "engine" : "deck";
};
/** Legacy adaptive pickup rule. */
export const isPickup = (turnIndex: number) => turnIndex > 0 && turnIndex % 4 === 3;
export const MAX_ANSWER_CHARS = 2000;

export function moduleFor(turnIndex: number): InterviewModule {
  if (turnIndex < 2) return "spoken_english";
  if (turnIndex < 11) return "technical";
  if (turnIndex === 11) return "writing";
  return "composure";
}
export function technicalStageFor(turnIndex: number): TechnicalStage | null {
  if (turnIndex < 2 || turnIndex > 10) return null;
  return (["immediate", "investigation", "resolution"] as const)[(turnIndex - 2) % 3];
}
export const isFourPartPickup = (turnIndex: number) => technicalStageFor(turnIndex) === "immediate";
export function fourPartTimeLimit(turnIndex: number): number {
  const stage = technicalStageFor(turnIndex);
  if (stage === "immediate") return 25;
  if (stage === "investigation") return 90;
  if (stage === "resolution") return 120;
  if (moduleFor(turnIndex) === "writing") return 300;
  return 90;
}

export type Phase = "baseline" | "troubleshooting" | "safety" | "leadership";
export interface Turn { question: string; answer: string; phase?: Phase; depth?: number; safety_flag?: boolean; gap?: string | null; topic?: string; pillar?: string; module?: InterviewModule; mode?: "voice" | "text" }
export interface ExamInput { rank: string; targetRank?: string; vessel?: string; language?: string; turns: Turn[]; answer?: string; answerMode?: "voice" | "text" }

export interface Assessment { topic: string; depth: number; safety_flag: boolean; gap: string | null; feedback: string; pillar?: string; module?: InterviewModule }
export interface ExamStep { assessment: Assessment | null; next_question: string | null; phase: Phase | null; done: boolean; module?: InterviewModule | null }

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
export function nextPillar(turns: Turn[], dept: Department): string {
  const stats = pillarStats(turns);
  const last = turns[turns.length - 1];
  const weakLast = last && typeof last.depth === "number" && last.depth <= 1 ? last.pillar : undefined;
  const pool = PILLARS[dept].filter((p) => p !== weakLast);
  return [...pool].sort((a, b) => (stats[a]?.n ?? 0) - (stats[b]?.n ?? 0))[0];
}

export type StopReason = "mastery" | "standard" | "max" | null;
/** Adaptive exit gates. ≥80% with no safety flag after 12 (all pillars seen) ends early; ≥65% after 25; hard cap 40. */
export function examDecision(turns: Turn[], dept: Department = "engine"): StopReason {
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
  const answerMode = b.answerMode === "voice" ? "voice" as const : b.answerMode === "text" ? "text" as const : undefined;
  return { ok: true, value: { rank, targetRank, vessel, language, turns, answer, answerMode } };
}

/** Builds chat messages: brain system prompt + examiner protocol + transcript. */
export function buildExamMessages(input: ExamInput, pendingQuestion: string | null, seed = 0, framework: InterviewFramework = "adaptive_v1") {
  const four = framework === FOUR_PART_FRAMEWORK;
  const turnIndex = input.turns.length + (pendingQuestion ? 1 : 0);
  const userText = [...input.turns.map((t) => t.answer), input.answer ?? ""].join(" ");
  const system = buildBrainPrompt({
    rank: input.rank, targetRank: input.targetRank, vessel: input.vessel as VesselType | undefined,
    mode: "interview", language: input.language, userText,
  });
  const nextPhase = phaseFor(turnIndex);
  const dept = departmentOf(input.rank);
  const known = input.turns.map((t) => ({ ...t }));
  const stage = four ? technicalStageFor(turnIndex) : null;
  const continuingIncident = four && stage !== null && stage !== "immediate";
  const lastPillar = known[known.length - 1]?.pillar;
  const pillar = continuingIncident && lastPillar ? lastPillar : nextPillar(known, dept);
  const pickup = four ? isFourPartPickup(turnIndex) : isPickup(turnIndex);
  let protocol: string;
  if (four) {
    const currentModule = moduleFor(turnIndex);
    const moduleInstruction = currentModule === "spoken_english"
      ? `PART 1 — SPOKEN ENGLISH & MARITIME COMMUNICATION. Ask a rank-specific operational question requiring a spoken explanation, handover or standard maritime phrase. Score intelligibility of the transcript, vocabulary, sentence structure and role-appropriate communication. Never penalise accent, nationality or disability. Answer evidence: ${input.answerMode ?? "question generation"}; if text, assess written Maritime English only and never claim pronunciation or fluency was heard.`
      : currentModule === "technical"
        ? stage === "immediate"
          ? `PART 2 — CASCADING TECHNICAL SCENARIO, IMMEDIATE REFLEX (25 seconds). Start a NEW realistic rank-specific incident with dynamic vessel, weather, cargo/machinery and alarm details. Ask for the best FIRST action. Give exactly 4 options on separate lines formatted "A) …", "B) …", "C) …", "D) …", with one clearly safest answer.`
          : stage === "investigation"
            ? `PART 2 — SAME INCIDENT, INVESTIGATION. Continue the immediately preceding incident; never start a new one. Ask for safe diagnostic checks, likely causes and priorities based on the candidate's first action.`
            : `PART 2 — SAME INCIDENT, RESOLUTION. Continue the same incident; never start a new one. Ask for recovery, team/resource coordination, required notifications, SMS records and rank-appropriate operational or commercial resolution.`
        : currentModule === "writing"
          ? `PART 3 — WRITTEN REPORT. Give ONE rank-appropriate written task: management ranks write a concise formal email/report to the Master, superintendent or terminal; operational/support ranks write a handover, log entry or defect/incident report; catering ranks write a hygiene, provisions or allergy incident report. Require time, facts, immediate actions, notifications and next steps. Do not request private medical or family information.`
          : `PART 4 — OCCUPATIONAL COMPOSURE. Ask a realistic work scenario involving simultaneous alarms, conflicting priorities, fatigue management or crew conflict. Score observable professional decisions: calm prioritisation, communication, rest-hour compliance, escalation and refusal of unsafe work. Never ask about or infer mental health, wellness, diagnosis, private feelings, family circumstances or medical history.`;
    protocol = [
      `Examiner protocol: senior superintendent conducting a four-part maritime interview. One question per turn, maximum 100 words. Complete all 14 turns: 2 spoken English, 9 cascading technical (3 incidents × immediate/investigation/resolution), 1 written report, 2 occupational composure.`,
      `Dedicated rank track and vessel context in the Maritime Brain prompt are mandatory. Do not ask generic textbook definitions when a scenario can test the duty.`,
      `Current part: ${currentModule}. Technical stage: ${stage ?? "not applicable"}. Responsibility pillar: ${pillar}.`,
      moduleInstruction,
      `Vary incidents and parameters using variation key ${seed % 997}; never repeat an earlier question. Do not reveal model answers or learning feedback during the interview.`,
      `If an answer proposes an unsafe action, set safety_flag true, name the hazard in feedback and cap depth at 1. For pickup answers judge both the option and reason; a wrong option is depth ≤1.`,
      `depth scale: 0 no answer, 1 unsafe/incorrect, 2 partial, 3 competent, 4 expert. For English score communication only; for writing score structure, clarity and maritime terminology; for composure score professional actions only.`,
      turnIndex >= FOUR_PART_TURNS ? `This is the final answer: set next_question to null.` : `Never finish before all ${FOUR_PART_TURNS} answers. You are now generating question ${turnIndex + 1} of ${FOUR_PART_TURNS}.`,
      `Return ONLY JSON: {"assessment": {"topic": string, "pillar": one of [${PILLARS[dept].join(", ")}], "depth": 0-4, "safety_flag": boolean, "gap": string|null, "feedback": string} | null, "next_question": string|null}. assessment is null when there is no answer to assess. The assessment pillar is the pillar of the question just answered.`,
    ].join("\n");
  } else {
    protocol = [
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
  }
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

// A described unsafe action (e.g. "we grind without a permit", "I bypassed the 15 ppm alarm").
// Sentences that describe preventing/refusing the action ("I would stop anyone working without a permit") are not flagged.
const VIOLATION = /\b(without\s+(an?\s+|the\s+|any\s+)?(hot[\s-]?work\s+|work\s+)?(permit|ptw|isolat\w*|lock[\s-]?out|loto|ventilat\w*|gas[\s-]?test\w*|atmosphere\s+test\w*|testing)|bypass(ed|ing)?|overrid(e|den|ing)|disabl(e|ed|ing)\s+(the\s+)?(alarm|trip|interlock|sensor|monitor)|ignor(e|ed|ing)\s+(the\s+)?alarm|(pump|discharg|dump)\w*\s+(\w+\s+){0,3}(directly\s+)?overboard|vent(ed|ing)?\s+(the\s+)?cargo\s+to\s+(the\s+)?atmosphere)\b/i;
const PREVENTIVE = /\b(never|not|no\s+one|nobody|don'?t|do\s+not|won'?t|will\s+not|must\s+not|cannot|can'?t|should\s+not|shouldn'?t|stop\w*|prohibit\w*|forbid\w*|refuse\w*|suspend\w*|report\w*|prevent\w*|avoid\w*|under\s+no|not\s+allowed|illegal|violation|unsafe|wrong)\b/i;
export function unsafeAction(answer: string): boolean {
  return (answer || "").split(/(?<=[.!?;])\s+|\n+/).some((s) => VIOLATION.test(s) && !PREVENTIVE.test(s));
}

/** A deterministic continuation backstop: an AI null response can never skip a required part. */
export function fallbackFourPartQuestion(turnIndex: number): string {
  const module = moduleFor(turnIndex);
  const stage = technicalStageFor(turnIndex);
  if (module === "spoken_english") return "Using clear Maritime English, explain how you would give a complete operational handover for your rank, including the current situation, hazards, actions taken and next steps.";
  if (stage === "immediate") return "A critical alarm activates during your assigned shipboard operation. What is the safest FIRST action for your rank?\nA) Stop the operation, protect life, inform the responsible officer and follow the vessel SMS\nB) Continue at the same speed to avoid delay\nC) Silence the alarm before checking the cause\nD) Wait without informing anyone";
  if (stage === "investigation") return "Continue the incident in your previous answer. Which safe diagnostic checks would you make, in what order, and which readings or evidence would you verify before acting?";
  if (stage === "resolution") return "Continue the same incident. How would you coordinate recovery, notify the responsible parties, keep required records and confirm safe conditions before normal operations resume?";
  if (module === "writing") return "Write a concise report to your responsible officer about an operational defect or incident in your rank's duties. Include time, facts, immediate safety actions, people notified and recommended next steps.";
  return turnIndex % 2 === 0
    ? "During a critical operation, two team members disagree and several tasks compete for attention. How would you restore safe teamwork, prioritise the work, communicate and comply with rest-hour requirements?"
    : "Several alarms sound while a key team member reports exhaustion near the end of a watch. How would you prioritise the alarms, arrange safe relief, communicate with your senior officer and keep the operation under control?";
}

/** Validates AI JSON and applies deterministic safety rules on top of it. */
export function finalizeStep(aiRaw: unknown, answer: string | undefined, turnIndex: number, prior?: { turns: Turn[]; question: string; dept: Department }, framework: InterviewFramework = "adaptive_v1"): ExamStep {
  const four = framework === FOUR_PART_FRAMEWORK;
  const o = (aiRaw ?? {}) as any;
  let assessment: Assessment | null = null;
  if (answer !== undefined) {
    const a = o.assessment ?? {};
    const blank = !answer || /^(i don'?t know|dont know|no idea|pass|skip|-|\[no answer — time expired\])$/i.test(answer.trim());
    let depth = Math.max(0, Math.min(4, Math.round(Number(a.depth) || 0)));
    if (blank) depth = 0;
    let safety = a.safety_flag === true;
    // Deterministic net: a safety-gate scenario answered without any core precaution is flagged.
    const gates = detectSafetyGates(answer);
    if (!blank && gates.length && !/(permit|isolat|ventilat|gas test|test the atmosphere|lock|tag|standby|inform|stop)/i.test(answer)) safety = true;
    if (!blank && unsafeAction(answer)) safety = true;
    if (safety) depth = Math.min(depth, 1);
    assessment = {
      topic: String(a.topic ?? "general").slice(0, 80),
      depth, safety_flag: safety,
      gap: blank ? "No answer given" : (a.gap ? String(a.gap).slice(0, 200) : null),
      feedback: String(a.feedback ?? "").slice(0, 400),
      ...(four ? { module: moduleFor(Math.max(0, turnIndex - 1)) } : {}),
    };
    const allowed = prior ? (PILLARS[prior.dept] as readonly string[]) : [...PILLARS.engine, ...PILLARS.deck, ...PILLARS.catering];
    if (typeof a.pillar === "string" && allowed.includes(a.pillar)) assessment.pillar = a.pillar;
  }
  const stop = !four && prior && assessment ? examDecision([...prior.turns, { question: prior.question, answer: answer ?? "", ...assessment }], prior.dept) : null;
  const cap = four ? FOUR_PART_TURNS : MAX_TURNS;
  const done = turnIndex >= cap || !!stop;
  let q = !done && typeof o.next_question === "string" && o.next_question.trim() ? o.next_question.trim().slice(0, 900) : null;
  if (four && !done && !q) q = fallbackFourPartQuestion(turnIndex);
  return { assessment, next_question: q, phase: q ? phaseFor(turnIndex) : null, done: four ? done : done || !q, module: q && four ? moduleFor(turnIndex) : null };
}

export type Verdict = "ready" | "ready_with_training" | "not_ready";
export type ModuleScores = Partial<Record<InterviewModule, { pct: number; evidence?: "voice" | "mixed" | "text" }>>;
export function summarise(turns: Turn[]): { technical_pct: number; safety_flags: number; gaps: string[]; verdict: Verdict; strengths: string[]; module_scores: ModuleScores | null } {
  const allScored = turns.filter((t) => typeof t.depth === "number");
  const fourPart = allScored.some((t) => t.module);
  const scored = fourPart ? allScored.filter((t) => t.module === "technical") : allScored;
  const technical_pct = scored.length ? Math.round((scored.reduce((s, t) => s + (t.depth as number), 0) / (scored.length * 4)) * 100) : 0;
  const safety_flags = scored.filter((t) => t.safety_flag).length;
  const gaps = [...new Set(allScored.map((t) => t.gap).filter((g): g is string => !!g))];
  const verdict: Verdict = safety_flags >= 2 || technical_pct < 50 ? "not_ready" : safety_flags === 1 || technical_pct < 75 ? "ready_with_training" : "ready";
  const strengths = Object.entries(pillarStats(scored)).filter(([, v]) => v.pct >= 75).map(([k]) => k);
  let module_scores: ModuleScores | null = null;
  if (fourPart) {
    module_scores = {};
    for (const module of ["spoken_english", "technical", "writing", "composure"] as const) {
      const rows = allScored.filter((t) => t.module === module);
      if (!rows.length) continue;
      const pct = Math.round((rows.reduce((s, t) => s + (t.depth as number), 0) / (rows.length * 4)) * 100);
      module_scores[module] = module === "spoken_english"
        ? { pct, evidence: rows.every((t) => t.mode === "voice") ? "voice" : rows.some((t) => t.mode === "voice") ? "mixed" : "text" }
        : { pct };
    }
  }
  return { technical_pct, safety_flags, gaps, verdict, strengths, module_scores };
}
