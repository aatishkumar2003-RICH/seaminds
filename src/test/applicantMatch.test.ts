import { describe, it, expect } from "vitest";
import { matchApplicantToVacancy } from "@/lib/smartMatch";

describe("matchApplicantToVacancy", () => {
  it("exact rank aliases score as a match", () => {
    const r = matchApplicantToVacancy({ crewRank: "C/E", availableFrom: "2020-01-01" }, { rank: "Chief Engineer" });
    expect(r.isMatch).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(80);
  });
  it("different department is not a match", () => {
    const r = matchApplicantToVacancy({ crewRank: "Cook" }, { rank: "Chief Engineer" });
    expect(r.isMatch).toBe(false);
  });
});
