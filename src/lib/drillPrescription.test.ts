import { describe, it, expect } from "vitest";
import { drillForGap, prescribeDrills, drillLink } from "./drillPrescription";

describe("drill prescription", () => {
  it("maps gap keywords to the matching vessel drill", () => {
    expect(drillForGap("IMSBC liquefaction checks")).toBe("bulk");
    expect(drillForGap("BOG compressor trip handling")).toBe("gas");
    expect(drillForGap("Inert gas deck seal water level")).toBe("tanker");
    expect(drillForGap("Ammonia leak response")).toBe("reefer");
    expect(drillForGap("Container lashing forces")).toBe("container");
  });
  it("falls back to the candidate's vessel type", () => {
    expect(drillForGap("Leadership and communication", "gas_carrier")).toBe("gas");
    expect(drillForGap("Leadership", "offshore")).toBeNull();
  });
  it("de-duplicates and always prescribes the vessel drill when no gap matches", () => {
    expect(prescribeDrills(["hatch cover tightness", "grain loading"], "container")).toEqual(["bulk"]);
    expect(prescribeDrills([], "oil_tanker")).toEqual(["tanker"]);
  });
  it("builds a deep link into the drills tab", () => {
    expect(drillLink("reefer")).toBe("/training?tab=drills&drill=reefer");
  });
});
