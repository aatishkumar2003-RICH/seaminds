import { describe, it, expect } from "vitest";
import { phaseStats, trbShareText } from "@/lib/cadetTrbPdf";
import { oralFor, ORAL_BANK } from "@/lib/cadetOralBank";

describe("cadet e-TRB reports", () => {
  it("splits 32 modules into 4 phases (4/8/12/8)", () => {
    expect(phaseStats([]).map((p) => p.total)).toEqual([4, 8, 12, 8]);
    expect(phaseStats([{ week: 3, score: 80, completed_at: "x" }, { week: 5, score: 70, completed_at: "x" }]).map((p) => p.done)).toEqual([1, 1, 0, 0]);
  });
  it("share text states completed count and percentage", () => {
    const t = trbShareText({ name: "A", track: "deck", current_week: 2, results: [{ week: 1, score: 90, completed_at: "x" }] });
    expect(t).toContain("Completed 1/32 modules (3%)");
  });
  it("oral bank uses only junior-rank questions and matches by topic", () => {
    expect(ORAL_BANK.engine.length).toBeGreaterThan(20);
    expect(oralFor("engine", "purifier separator fuel oil").length).toBeGreaterThan(0);
  });
});
