import { describe, expect, it } from "vitest";
import { seaServiceContext } from "../../supabase/functions/_shared/maritimeExaminer";

describe("CV sea-service grounding", () => {
  it("uses a valid 7-digit IMO", () => {
    expect(seaServiceContext([{ vessel_name: "Palm Island", imo: "9482124", vessel_type: "Bulk Carrier" }])).toContain("Palm Island (IMO 9482124)");
  });
  it("works without IMO using name and type", () => {
    const t = seaServiceContext([{ vesselName: "Star Clipper", vesselType: "Tanker" }]);
    expect(t).toContain("Star Clipper, Tanker");
    expect(t).not.toContain("IMO ");
  });
  it("drops dummy or invalid IMO numbers", () => {
    expect(seaServiceContext([{ vessel_name: "X", imo: "0000000" }])).not.toContain("IMO 0");
    expect(seaServiceContext([{ vessel_name: "X", imo: "123" }])).not.toContain("IMO 123");
  });
  it("returns nothing when no sea service, so rank/vessel fallback applies", () => {
    expect(seaServiceContext(null)).toBe("");
    expect(seaServiceContext([{}])).toBe("");
  });
});
