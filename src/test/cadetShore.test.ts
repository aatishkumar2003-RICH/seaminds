import { describe, it, expect } from "vitest";
import { shoreModule, shoreCleared, isShoreWeek } from "@/lib/cadetShoreInduction";

describe("Part 1 pre-joining induction", () => {
  it("has a full manual for modules 1–4 on both tracks and none for onboard", () => {
    for (const t of ["deck", "engine"] as const) {
      for (let w = 1; w <= 4; w++) { const m = shoreModule(t, w)!; expect(m.sections.length).toBeGreaterThanOrEqual(4); expect(m.drills.length).toBeGreaterThanOrEqual(6); expect(m.drills.every((d) => d.a >= 0 && d.a < d.o.length)).toBe(true); }
      expect(shoreModule(t, 5)).toBeNull();
    }
    expect(shoreModule("deck", 3)!.competence).toMatch(/A-II\/1/); expect(shoreModule("engine", 3)!.competence).toMatch(/A-III\/1/);
    expect(isShoreWeek(4)).toBe(true); expect(isShoreWeek(5)).toBe(false);
  });
  it("clears Part 1 only when all four shore modules are passed at 60%+", () => {
    const d = "2026-11-13";
    expect(shoreCleared([1, 2, 3, 4].map((week) => ({ week, score: 80, completed_at: d })))).toBe(true);
    expect(shoreCleared([1, 2, 3].map((week) => ({ week, score: 80 })))).toBe(false);
    expect(shoreCleared([{ week: 1, score: 80 }, { week: 2, score: 59 }, { week: 3, score: 90 }, { week: 4, score: 90 }])).toBe(false);
  });
});
