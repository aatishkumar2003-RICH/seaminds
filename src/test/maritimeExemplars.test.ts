import { describe, it, expect } from "vitest";
import { EXEMPLARS, exemplarGuidance } from "../../supabase/functions/_shared/maritimeExemplars";
import { buildExamMessages } from "../../supabase/functions/_shared/maritimeExaminer";

describe("superintendent seeds", () => {
  it("loads the officer banks by rank", () => {
    expect(EXEMPLARS.chief_engineer.length).toBeGreaterThan(100);
    expect(EXEMPLARS.second_officer.length).toBeGreaterThan(100);
  });
  it("frames seeds as inspiration, not a script", () => {
    const g = exemplarGuidance("chief_officer", 3);
    expect(g).toMatch(/never copy them verbatim/);
    expect(exemplarGuidance("master", 1)).not.toBe("");
  });
  it("adds seeds to opening technical turns of the interview", () => {
    const turns = [{ question: "q1", answer: "a1" }];
    const { messages } = buildExamMessages({ rank: "Chief Engineer", turns, answer: "a2" } as any, "q2", 5, "four_in_one_v1");
    expect(messages[0].content).toMatch(/learning seeds/);
  });
});
