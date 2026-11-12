import { describe, it, expect } from "vitest";
import { trainingInviteText } from "@/components/manager/TrainingInviteCard";
describe("trainingInviteText", () => {
  it("numbers AI briefings after library modules", () => {
    const t = trainingInviteText("Acme", ["MLC 2006"], "https://x", [{ title: "SMCP English", objectives: ["a"], key_points: ["b"], self_check: ["c"] }]);
    expect(t).toContain("1. MLC 2006");
    expect(t).toContain("📘 2. SMCP English");
  });
});
