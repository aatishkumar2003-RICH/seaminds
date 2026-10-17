import { describe, it, expect } from "vitest";
import { CONSENT_TEXT, CONSENT_VERSION, consentCacheKey } from "@/lib/legalConsent";

describe("legal consent", () => {
  it("keeps crew and manager acceptance separate", () => {
    expect(consentCacheKey("u1", "crew")).not.toBe(consentCacheKey("u1", "manager"));
  });
  it("re-asks when the version changes", () => {
    expect(consentCacheKey("u1", "crew", "2027.1")).not.toBe(consentCacheKey("u1", "crew", CONSENT_VERSION));
  });
  it("crew agreement says no employment fees under MLC 2006", () => {
    expect(CONSENT_TEXT.crew.points.some((p) => p.h.includes("MLC 2006"))).toBe(true);
  });
});
