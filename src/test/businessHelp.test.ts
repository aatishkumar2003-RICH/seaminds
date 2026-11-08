import { describe, expect, it } from "vitest";
import { businessHelpAudience } from "../lib/businessHelp";

describe("Business DORA placement", () => {
  it("includes manager workflows", () => {
    for (const path of ["/manager", "/manager/dashboard", "/manager/interviews", "/manager-search", "/post-vacancy", "/management/fleet"]) expect(businessHelpAudience(path)).toBe("manager");
  });
  it("includes seller and buyer workflows", () => {
    for (const path of ["/marketplace", "/marketplace/vendor", "/marketplace/post"]) expect(businessHelpAudience(path)).toBe("marketplace");
  });
  it("helps crew on job and profile pages", () => {
    for (const path of ["/feed", "/jobs/chief-officer-abc", "/quick-profile", "/profile"]) expect(businessHelpAudience(path)).toBe("crew");
  });
  it("helps companies on public company pages", () => {
    for (const path of ["/for-companies", "/pricing", "/contact"]) expect(businessHelpAudience(path)).toBe("manager");
  });
  it("does not open business help over crew assessments or wellness", () => {
    for (const path of ["/app", "/interview/secret/exam", "/training", "/maritime-interview", "/admin", "/marketplace-other"]) expect(businessHelpAudience(path)).toBeNull();
  });
});