import { describe, it, expect } from "vitest";
import { vesselGroupBySlug as g, vesselMatches as m } from "@/lib/vesselGroups";
describe("vesselMatches", () => {
  it("tug", () => { expect(m(g("tug")!, "Tug Boat")).toBe(true); expect(m(g("tug")!, "Bulk Carrier")).toBe(false); });
  it("LPG is gas, not tanker", () => { expect(m(g("gas")!, "LPG Carrier")).toBe(true); expect(m(g("tanker")!, "LPG Carrier")).toBe(false); });
  it("multi-vessel belongs to several", () => { const v = "Tankers, Bulk Carriers"; expect(m(g("tanker")!, v)).toBe(true); expect(m(g("bulk")!, v)).toBe(true); });
  it("short keys need word boundary", () => { expect(m(g("offshore")!, "DP2 PSV")).toBe(true); expect(m(g("offshore")!, "Product tanker")).toBe(false); });
});
