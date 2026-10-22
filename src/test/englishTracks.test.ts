import { describe, it, expect } from "vitest";
import { tracksFor, buildExam, gradeExam, RANK_POOLS } from "@/lib/englishTracks";

describe("english tracks", () => {
  it("offers 1, 3 and 7 day classes", () => {
    expect(tracksFor("engine").map((t) => t.days.length)).toEqual([1, 3, 6]);
  });
  it("exam has 3 questions from the crew's own rank pool", () => {
    const ex = buildExam("rating", {});
    expect(ex).toHaveLength(3);
    ex.forEach((s) => expect(RANK_POOLS.rating).toContain(s.id));
  });
  it("pass mark is 75%", () => {
    const sc = buildExam("deck", {})[0];
    expect(gradeExam("3d", [{ sc, score: 75 }]).passed).toBe(true);
    expect(gradeExam("3d", [{ sc, score: 74 }]).passed).toBe(false);
  });
});
