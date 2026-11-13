import { describe, it, expect } from "vitest";
import { lessonFor } from "@/lib/cadetLessons";
describe("cadet lessons", () => {
  it("every week of both tracks has study material", () => {
    for (const tr of ["deck", "engine"] as const) for (let w = 1; w <= 32; w++) { const l = lessonFor(tr, w); expect(l.steps.length).toBeGreaterThan(3); expect(l.scenario.right.length).toBeGreaterThan(10); }
  });
  it("bunkering week teaches bunkering", () => { expect(lessonFor("engine", 13).why).toMatch(/[Bb]unker/); });
});
