import { describe, it, expect } from "vitest";
import { CADET_CURRICULUM, cadetFlag, stageLabel } from "@/lib/cadetCurriculum";
import { assignmentEmail } from "../../supabase/functions/_shared/interviewFollowup";

describe("cadet academy", () => {
  it("has 32 weeks per track: 4 shore + 28 onboard", () => {
    for (const t of ["deck", "engine"] as const) {
      expect(CADET_CURRICULUM[t]).toHaveLength(32);
      expect(CADET_CURRICULUM[t].filter((w) => w.stage === "shore")).toHaveLength(4);
    }
  });
  it("deck and engine week 3 differ (department-specific basics)", () => {
    expect(CADET_CURRICULUM.deck[2].t).not.toBe(CADET_CURRICULUM.engine[2].t);
  });
  it("never ships answer keys to the browser", () => {
    expect(JSON.stringify(CADET_CURRICULUM)).not.toContain('"a":');
  });
  it("labels stages", () => { expect(stageLabel(4)).toBe("Shore induction"); expect(stageLabel(5)).toBe("Onboard · Month 1"); expect(stageLabel(32)).toBe("Onboard · Month 7"); });
  it("flags overdue over 7 days and weak under 60%", () => {
    expect(cadetFlag({ status: "active", overdue_days: 8, avg_score: 90, low_weeks: 0 })).toBe("overdue");
    expect(cadetFlag({ status: "active", overdue_days: 0, avg_score: 55, low_weeks: 0 })).toBe("weak");
    expect(cadetFlag({ status: "active", overdue_days: 3, avg_score: 80, low_weeks: 0 })).toBe("ok");
  });
  it("pending digest lists items; thank-you once done", () => {
    const p = assignmentEmail({ kind: "pending", crew_id: "x", email: "a@b.c", name: "Van", company: "Acme", items: [{ title: "Week 5", url: "https://seaminds.life/training?tab=cadet" }] });
    expect(p.subject).toContain("Pending for you: 1 training item from Acme");
    expect(p.text).toContain("These are the pending items assigned to you by Acme");
    expect(assignmentEmail({ kind: "thanks", crew_id: "x", email: "a@b.c", name: null, company: "Acme", items: [] }).subject).toContain("Thank you");
  });
});
