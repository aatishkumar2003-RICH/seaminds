import { describe, it, expect } from "vitest";
import { examDecision, nextPillar, isPickup, finalizeStep, PILLARS, MAX_TURNS } from "../../supabase/functions/_shared/maritimeExaminer";
import { pickupOptions } from "./maritimeInterview";
const P = PILLARS.engine;
const turns = (n: number, depth: number, flag = false) => Array.from({ length: n }, (_, i) => ({ question: "q", answer: "a", depth, safety_flag: flag && i === 0, pillar: P[i % 5] }));
describe("adaptive interview length", () => {
  it("80%+ with no safety flag ends early at 12 questions", () => {
    expect(examDecision(turns(11, 4))).toBeNull();
    expect(examDecision(turns(12, 4))).toBe("mastery");
  });
  it("a safety flag blocks the early exit", () => expect(examDecision(turns(12, 4, true))).toBeNull());
  it("65%+ closes at 25 questions", () => {
    expect(examDecision(turns(24, 3))).toBeNull(); // 75%
    expect(examDecision(turns(25, 3))).toBe("standard");
  });
  it("weak candidate keeps going until 40", () => {
    expect(examDecision(turns(39, 2))).toBeNull();
    expect(examDecision(turns(MAX_TURNS, 2))).toBe("max");
  });
  it("after a weak answer the next question moves to another area", () => {
    const t = [{ question: "q", answer: "a", depth: 0, pillar: "main_propulsion" }];
    expect(nextPillar(t, "engine")).not.toBe("main_propulsion");
  });
  it("every 4th question is a quick decision", () => expect([1, 2, 3, 4, 7].map(isPickup)).toEqual([false, false, true, false, true]));
  it("mastery decision marks the step done", () => {
    const s = finalizeStep({ assessment: { depth: 4, pillar: "paperwork_sms" }, next_question: "Next" }, "good answer", 12, { turns: turns(11, 4), question: "q", dept: "engine" });
    expect(s.done).toBe(true);
  });
  it("parses A–D options", () => expect(pickupOptions("Fire!\nA) Stop\nB) Call\nC) Run\nD) Wait")?.map(o => o.key)).toEqual(["A", "B", "C", "D"]));
});
