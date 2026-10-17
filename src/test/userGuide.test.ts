import { describe, expect, it } from "vitest";
import { guideLink, guideRoleFromProfiles, guideStep, parseGuideRole } from "@/lib/userGuide";
describe("public guide personalisation", () => {
  it("defaults to crew without company profiles", () => { expect(guideRoleFromProfiles(false, false)).toBe("crew"); });
  it("defaults to ShipManager for a manager profile", () => { expect(guideRoleFromProfiles(true, false)).toBe("manager"); });
  it("defaults to staff for a staff profile", () => { expect(guideRoleFromProfiles(true, true)).toBe("staff"); expect(guideRoleFromProfiles(false, true)).toBe("staff"); });
  it("rejects unknown audiences", () => { expect(parseGuideRole("admin")).toBeNull(); expect(parseGuideRole("staff")).toBe("staff"); });
  it("shares exact audience, lesson and step", () => { const link = new URL(guideLink("https://seaminds.life", "crew", "certificates", 2)); expect(link.pathname).toBe("/guide"); expect(Object.fromEntries(link.searchParams)).toEqual({ role: "crew", section: "certificates", step: "2" }); });
  it("bounds invalid or oversized steps", () => { expect(guideStep("900", 4)).toBe(3); expect(guideStep("-2", 4)).toBe(0); expect(guideStep("NaN", 4)).toBe(0); });
});