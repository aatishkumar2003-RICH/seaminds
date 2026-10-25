import { describe, it, expect } from "vitest";
import { overallScore, finalizeProblems, badgeFor, type Appraisal } from "./crewAppraisal";

const base: Appraisal = { contract_id: "c", appraiser_name: "Capt. Rao", appraiser_role: "master", period_from: null, period_to: null,
  safety: 4, technical: 4, emergency: 4, teamwork: 4, english: 4, leadership: 4, rehire_verdict: "rehire", promotion_verdict: "maintain_rank",
  training_needs: [], remarks: "", status: "draft" };

describe("crew appraisal", () => {
  it("overall is the average of six criteria on 1-5", () => {
    expect(overallScore({ ...base, safety: 5, leadership: 3 })).toBe(4);
    expect(overallScore({ ...base, safety: 5, technical: 5, emergency: 4, teamwork: 4, english: 3, leadership: 3 })).toBe(4);
  });
  it("re-employ after training needs at least one training item", () => {
    expect(finalizeProblems({ ...base, rehire_verdict: "rehire_with_training" })).toHaveLength(1);
    expect(finalizeProblems({ ...base, rehire_verdict: "rehire_with_training", training_needs: ["Maritime English"] })).toHaveLength(0);
  });
  it("appraiser name is mandatory", () => {
    expect(finalizeProblems({ ...base, appraiser_name: " " })).toHaveLength(1);
  });
  it("badge only after finalizing; do-not-rehire wins", () => {
    expect(badgeFor({ ...base })).toBeNull();
    expect(badgeFor({ ...base, status: "finalized", rehire_verdict: "do_not_rehire", overall: 5 })?.label).toBe("Do not rehire");
    expect(badgeFor({ ...base, status: "finalized", overall: 4.6 })?.label).toBe("Top performer");
  });
});
