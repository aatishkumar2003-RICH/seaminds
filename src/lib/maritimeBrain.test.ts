import { describe, it, expect } from "vitest";
import { resolveRank, topicsFor, detectSafetyGates, buildBrainPrompt } from "../../supabase/functions/_shared/maritimeBrain";

describe("maritime brain", () => {
  it("resolves rank aliases", () => {
    expect(resolveRank("2nd Off")).toBe("second_officer");
    expect(resolveRank("2/E")).toBe("second_engineer");
    expect(resolveRank("Captain")).toBe("master");
  });
  it("engine syllabus includes purifiers, boilers, emergency power", () => {
    const ids = topicsFor("second_engineer").map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(["purifiers", "boilers", "emergency_power", "electrical"]));
  });
  it("deck syllabus covers GMDSS; gas cargo only for gas carriers", () => {
    expect(topicsFor("second_officer", "bulk").map((t) => t.id)).toContain("gmdss");
    expect(topicsFor("chief_officer", "bulk").map((t) => t.id)).not.toContain("cargo_gas");
    expect(topicsFor("chief_officer", "gas_carrier").map((t) => t.id)).toContain("cargo_gas");
  });
  it("operational ranks do not get management topics", () => {
    expect(topicsFor("third_engineer").map((t) => t.id)).not.toContain("eng_management");
  });
  it("detects enclosed space and scavenge fire gates", () => {
    expect(detectSafetyGates("entering ballast tank").map((g) => g.id)).toContain("enclosed_space");
    expect(detectSafetyGates("scavenge fire on unit 4").map((g) => g.id)).toContain("machinery_fire");
  });
  it("prompt targets promotion rank and injects safety gate", () => {
    const p = buildBrainPrompt({ rank: "2/E", targetRank: "Chief Eng", mode: "interview", userText: "busbar fault" });
    expect(p).toContain("target rank: chief_engineer");
    expect(p).toContain("Electrical isolation / LOTO");
  });
});
