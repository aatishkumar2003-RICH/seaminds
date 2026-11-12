import { describe, it, expect } from "vitest";
import { trainingInviteText } from "@/components/manager/TrainingInviteCard";
import { ago, englishLevel } from "@/components/manager/TrainingRadar";

describe("training radar", () => {
  it("invite links carry the company tracking code", () => {
    const t = trainingInviteText("HP", [], "https://seaminds.life", [], [{ title: "E", path: "/training?tab=english" }], "abc");
    expect(t).toContain("/training?tab=english&utm_source=manager_invite&mt=abc");
    expect(t).toContain("/training?utm_source=manager_invite&mt=abc");
  });
  it("no tracking code when manager unknown", () => {
    expect(trainingInviteText("HP", ["A"])).not.toContain("mt=");
  });
  it("activity labels", () => {
    const now = Date.parse("2026-11-12T10:00:00Z");
    expect(ago("2026-11-12T09:59:30Z", now)).toBe("Active now");
    expect(ago("2026-11-12T09:30:00Z", now)).toBe("30 min ago");
    expect(englishLevel(60)).toBe("Developing");
  });
});
