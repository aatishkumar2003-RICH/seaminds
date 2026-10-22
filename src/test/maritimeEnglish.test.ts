import { describe, it, expect } from "vitest";
import { SCENARIOS, scoreAnswer } from "@/lib/maritimeEnglish";
const sc = SCENARIOS.find((s) => s.id === "vhf-tss")!;
describe("maritime english scoring", () => {
  it("model answer scores high", () => expect(scoreAnswer(sc, sc.model).total).toBeGreaterThanOrEqual(85));
  it("empty answer scores zero", () => expect(scoreAnswer(sc, "").total).toBe(0));
  it("missing facts are reported", () => expect(scoreAnswer(sc, "Ocean Star read back over").missed).toContain("anchorage"));
});
import { pickVariant, deptOf, nextRecommended } from "@/lib/maritimeEnglish";
import { HINTS } from "@/lib/maritimeEnglishHints";
describe("smart practice", () => {
  it("every scenario has Vietnamese, Indonesian and Hindi hints", () => {
    for (const s of SCENARIOS) for (const l of ["vi", "id", "hi"] as const) expect(HINTS[l][s.id], `${l}:${s.id}`).toBeTruthy();
  });
  it("variant model answers still score high", () => {
    for (const s of SCENARIOS) for (const r of [0, 0.99]) { const v = pickVariant(s, () => r); expect(scoreAnswer(v, v.model).total, v.id).toBeGreaterThanOrEqual(85); }
  });
  it("detects department from rank", () => {
    expect(deptOf("Chief Engineer")).toBe("engine");
    expect(deptOf("AB Seaman")).toBe("rating");
    expect(deptOf("2nd Officer")).toBe("deck");
  });
  it("recommends an untried scenario first", () => expect(nextRecommended("engine", { "eng-handover": 90 }).id).not.toBe("eng-handover"));
});
