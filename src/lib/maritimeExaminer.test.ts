import { describe, it, expect } from "vitest";
import { validateInput, buildExamMessages, finalizeStep, summarise, phaseFor, MAX_TURNS } from "../../supabase/functions/_shared/maritimeExaminer";

describe("maritime examiner", () => {
  it("rejects unknown rank and too many turns", () => {
    expect(validateInput({ rank: "pilot fish" }).ok).toBe(false);
    expect(validateInput({ rank: "2/E", turns: Array(MAX_TURNS + 1).fill({}) }).ok).toBe(false);
  });
  it("phases progress baseline → leadership", () => {
    expect([0, 2, 4, 6].map(phaseFor)).toEqual(["baseline", "troubleshooting", "safety", "leadership"]);
  });
  it("first call asks to start; transcript replayed", () => {
    const v = validateInput({ rank: "2/E", targetRank: "C/E", turns: [{ question: "Q1", answer: "A1" }] });
    if (!v.ok) throw new Error();
    const { messages } = buildExamMessages(v.value, null);
    expect(messages[0].content).toContain("target rank: chief_engineer");
    expect(messages.map((m) => m.content)).toContain("A1");
  });
  it("blank answer scores 0", () => {
    expect(finalizeStep({ assessment: { depth: 3 }, next_question: "Next?" }, "I don't know", 1).assessment?.depth).toBe(0);
  });
  it("unsafe enclosed-space answer is flagged even if AI misses it", () => {
    const s = finalizeStep({ assessment: { depth: 4, safety_flag: false }, next_question: "Q" }, "I just go into the ballast tank quickly", 2);
    expect(s.assessment?.safety_flag).toBe(true);
    expect(s.assessment?.depth).toBeLessThanOrEqual(1);
  });
  it("final turn ends the interview", () => {
    const s = finalizeStep({ assessment: { depth: 3 }, next_question: "More?" }, "answer", MAX_TURNS);
    expect(s.done).toBe(true);
    expect(s.next_question).toBeNull();
  });
  it("verdicts: one safety flag = training, two = not ready", () => {
    const t = (depth: number, safety_flag = false) => ({ question: "", answer: "", depth, safety_flag });
    expect(summarise([t(4), t(4), t(4)]).verdict).toBe("ready");
    expect(summarise([t(4), t(4), t(1, true)]).verdict).toBe("ready_with_training");
    expect(summarise([t(4), t(1, true), t(1, true)]).verdict).toBe("not_ready");
  });
});
