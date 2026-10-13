import { describe, it, expect } from "vitest";
import { splitVesselTypes } from "@/lib/managerVacancies";

describe("splitVesselTypes", () => {
  it("splits the Synergy vessel list into 4 types", () => {
    expect(splitVesselTypes("Tankers, Gas Carriers, Bulk Carriers, Container Vessels")).toEqual(["Tanker", "Gas Carrier", "Bulk Carrier", "Container"]);
  });
  it("keeps a single vessel as one", () => {
    expect(splitVesselTypes("LPG")).toEqual(["LPG"]);
  });
  it("handles slash and 'and'", () => {
    expect(splitVesselTypes("Bulk / Container and Tanker")).toEqual(["Bulk", "Container", "Tanker"]);
  });
});
