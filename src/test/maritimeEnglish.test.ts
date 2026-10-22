import { describe, it, expect } from "vitest";
import { SCENARIOS, scoreAnswer } from "@/lib/maritimeEnglish";
const sc = SCENARIOS.find((s) => s.id === "vhf-tss")!;
describe("maritime english scoring", () => {
  it("model answer scores high", () => expect(scoreAnswer(sc, sc.model).total).toBeGreaterThanOrEqual(85));
  it("empty answer scores zero", () => expect(scoreAnswer(sc, "").total).toBe(0));
  it("missing facts are reported", () => expect(scoreAnswer(sc, "Ocean Star read back over").missed).toContain("anchorage"));
});
