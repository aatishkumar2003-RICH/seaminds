import { describe, it, expect } from "vitest";
import { unsafeAction, finalizeStep } from "../../supabase/functions/_shared/maritimeExaminer";
import { topicsFor } from "../../supabase/functions/_shared/maritimeBrain";

describe("unified syllabus", () => {
  it("LPG chief engineer is examined on gas cargo plant", () => {
    expect(topicsFor("chief_engineer", "gas_carrier").map((t) => t.id)).toContain("gas_plant");
  });
  it("gas plant is not given to bulk engineers or engine cadets", () => {
    expect(topicsFor("chief_engineer", "bulk").map((t) => t.id)).not.toContain("gas_plant");
    expect(topicsFor("engine_cadet", "gas_carrier").map((t) => t.id)).not.toContain("gas_plant");
  });
});

describe("unsafe action net", () => {
  it("flags hot work without a permit even though 'permit' appears", () => {
    expect(unsafeAction("We grind the flange without a hot work permit on the open deck.")).toBe(true);
    const s = finalizeStep({ assessment: { depth: 4 } }, "We grind the flange without a hot work permit on the open deck.", 2);
    expect(s.assessment?.safety_flag).toBe(true);
    expect(s.assessment?.depth).toBe(1);
  });
  it("flags bypassing monitoring and pumping overboard", () => {
    expect(unsafeAction("I bypassed the 15 ppm alarm to finish faster.")).toBe(true);
    expect(unsafeAction("I pumped the bilge directly overboard.")).toBe(true);
  });
  it("does not flag officers describing prevention", () => {
    expect(unsafeAction("If anyone works without a permit I stop the job and report to the Chief Officer.")).toBe(false);
    expect(unsafeAction("We never bypass the oily water separator.")).toBe(false);
  });
});
