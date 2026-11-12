import { describe, expect, it } from "vitest";
import {
  buildExamMessages, departmentOf, finalizeStep, FOUR_PART_FRAMEWORK, FOUR_PART_TURNS,
  fourPartTimeLimit, isFourPartPickup, moduleFor, summarise, technicalStageFor,
  type Turn,
} from "../../supabase/functions/_shared/maritimeExaminer";
import { resolveRank } from "../../supabase/functions/_shared/maritimeBrain";

const turns = (n: number): Turn[] => Array.from({ length: n }, (_, i) => ({ question: `Q${i}`, answer: "A", depth: 3, pillar: "cargo_stability" }));

describe("four-part interview structure", () => {
  it("requires two English, nine technical, one writing and two composure questions", () => {
    expect(Array.from({ length: FOUR_PART_TURNS }, (_, i) => moduleFor(i))).toEqual([
      "spoken_english", "spoken_english",
      ...Array(9).fill("technical"), "writing", "composure", "composure",
    ]);
    expect(FOUR_PART_TURNS).toBe(14);
  });
  it("runs three incidents through reflex, investigation and resolution", () => {
    expect([2, 3, 4, 5, 6, 7, 8, 9, 10].map(technicalStageFor)).toEqual([
      "immediate", "investigation", "resolution",
      "immediate", "investigation", "resolution",
      "immediate", "investigation", "resolution",
    ]);
    expect([2, 3, 5, 8, 11].map(isFourPartPickup)).toEqual([true, false, true, true, false]);
  });
  it("allows 25 seconds for immediate action and five minutes for the report", () => {
    expect(fourPartTimeLimit(2)).toBe(25);
    expect(fourPartTimeLimit(11)).toBe(300);
  });
  it("does not finish after question 12, and finishes at question 14", () => {
    const at12 = finalizeStep({ assessment: { depth: 3 }, next_question: "Next" }, "answer", 12,
      { turns: turns(11), question: "Q12", dept: "deck" }, FOUR_PART_FRAMEWORK);
    const at14 = finalizeStep({ assessment: { depth: 3 }, next_question: "Next" }, "answer", 14,
      { turns: turns(13), question: "Q14", dept: "deck" }, FOUR_PART_FRAMEWORK);
    expect(at12.done).toBe(false);
    expect(at14.done).toBe(true);
    expect(at14.next_question).toBeNull();
  });
});

describe("rank and evidence calibration", () => {
  it("has a dedicated Chief Officer cargo and ballast track", () => {
    const { messages } = buildExamMessages({ rank: "Chief Officer", turns: [] }, null, 1, FOUR_PART_FRAMEWORK);
    expect(messages[0].content).toContain("Chief Officer — cargo and ballast operations");
    expect(messages[0].content).toContain("PART 1 — SPOKEN ENGLISH");
  });
  it("covers ratings, electrical and catering ranks", () => {
    for (const rank of ["Ordinary Seaman", "Fitter", "Wiper", "ETO", "Chief Cook", "Cook", "Steward", "Messman"]) {
      expect(resolveRank(rank), rank).not.toBeNull();
    }
    expect(departmentOf("Chief Cook")).toBe("catering");
  });
  it("never claims to assess pronunciation from a typed English answer", () => {
    const { messages } = buildExamMessages({ rank: "Chief Engineer", turns: [], answer: "Typed answer", answerMode: "text" }, "Pending", 1, FOUR_PART_FRAMEWORK);
    expect(messages[0].content).toContain("never claim pronunciation or fluency was heard");
  });
  it("keeps composure occupational and bars wellness inference", () => {
    const { messages } = buildExamMessages({ rank: "Master", turns: turns(12) }, null, 1, FOUR_PART_FRAMEWORK);
    expect(messages[0].content).toContain("Never ask about or infer mental health, wellness, diagnosis");
  });
});

describe("server-owned four-part summary", () => {
  it("keeps technical percentage separate and records voice evidence", () => {
    const result = summarise([
      { question: "E", answer: "A", depth: 4, module: "spoken_english", mode: "voice" },
      { question: "T1", answer: "A", depth: 2, module: "technical" },
      { question: "T2", answer: "A", depth: 2, module: "technical" },
      { question: "W", answer: "A", depth: 1, module: "writing" },
      { question: "C", answer: "A", depth: 4, module: "composure" },
    ]);
    expect(result.technical_pct).toBe(50);
    expect(result.module_scores?.spoken_english).toEqual({ pct: 100, evidence: "voice" });
    expect(result.module_scores?.technical?.pct).toBe(50);
    expect(result.module_scores?.writing?.pct).toBe(25);
    expect(result.module_scores?.composure?.pct).toBe(100);
  });
});
