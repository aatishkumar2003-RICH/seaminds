// Phase 2 — adaptive examiner logic (pure, no imports besides the brain; vitest-testable).
import { buildBrainPrompt, detectSafetyGates, resolveRank, VESSEL_TYPES, type VesselType } from "./maritimeBrain.ts";

export const MAX_TURNS = 7;           // 5–7 scenarios ≈ 12–15 minutes
export const MAX_ANSWER_CHARS = 2000;

export type Phase = "baseline" | "troubleshooting" | "safety" | "leadership";
export interface Turn { question: string; answer: string; phase?: Phase; depth?: number; safety_flag?: boolean; gap?: string | null; topic?: string }
export interface ExamInput { rank: string; targetRank?: string; vessel?: string; language?: string; turns: Turn[]; answer?: string }

export interface Assessment { topic: string; depth: number; safety_flag: boolean; gap: string | null; feedback: string }
export interface ExamStep { assessment: Assessment | null; next_question: string | null; phase: Phase | null; done: boolean }

export function phaseFor(turnIndex: number): Phase {
  if (turnIndex < 2) return "baseline";
  if (turnIndex < 4) return "troubleshooting";
  if (turnIndex < 6) return "safety";
  return "leadership";
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
export function buildExamMessages(input: ExamInput, pendingQuestion: string | null) {
  const turnIndex = input.turns.length + (pendingQuestion ? 1 : 0);
  const userText = [...input.turns.map((t) => t.answer), input.answer ?? ""].join(" ");
  const system = buildBrainPrompt({
    rank: input.rank, targetRank: input.targetRank, vessel: input.vessel as VesselType | undefined,
    mode: "interview", language: input.language, userText,
  });
  const nextPhase = phaseFor(turnIndex);
  const protocol = [
    `Examiner protocol: one realistic shipboard scenario per question, max 90 words.`,
    `Next question phase: ${nextPhase} (baseline → troubleshooting → safety → leadership).`,
    `If the last answer was strong (depth ≥3) escalate difficulty; if weak, blank or "don't know" (depth ≤1), step down to a simpler question on the SAME topic to locate the gap; never repeat a question.`,
    `If the last answer proposed an unsafe action, set safety_flag true, name the hazard in feedback, and make the next question test recovery.`,
    `depth scale: 0 no answer, 1 unsafe/incorrect, 2 partial, 3 competent, 4 expert.`,
    turnIndex >= MAX_TURNS ? `This is the final answer: set next_question to null.` : "",
    `Return ONLY JSON: {"assessment": {"topic": string, "depth": 0-4, "safety_flag": boolean, "gap": string|null, "feedback": string} | null, "next_question": string|null}. assessment is null when there is no answer to assess.`,
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
  return { messages, nextPhase, turnIndex };
}

/** Validates AI JSON and applies deterministic safety rules on top of it. */
export function finalizeStep(aiRaw: unknown, answer: string | undefined, turnIndex: number): ExamStep {
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
  }
  const done = turnIndex >= MAX_TURNS;
  const q = !done && typeof o.next_question === "string" && o.next_question.trim() ? o.next_question.trim().slice(0, 900) : null;
  return { assessment, next_question: q, phase: q ? phaseFor(turnIndex) : null, done: done || !q };
}

export type Verdict = "ready" | "ready_with_training" | "not_ready";
export function summarise(turns: Turn[]): { technical_pct: number; safety_flags: number; gaps: string[]; verdict: Verdict } {
  const scored = turns.filter((t) => typeof t.depth === "number");
  const technical_pct = scored.length ? Math.round((scored.reduce((s, t) => s + (t.depth as number), 0) / (scored.length * 4)) * 100) : 0;
  const safety_flags = scored.filter((t) => t.safety_flag).length;
  const gaps = [...new Set(scored.map((t) => t.gap).filter((g): g is string => !!g))];
  const verdict: Verdict = safety_flags >= 2 || technical_pct < 50 ? "not_ready" : safety_flags === 1 || technical_pct < 75 ? "ready_with_training" : "ready";
  return { technical_pct, safety_flags, gaps, verdict };
}
