import { describe, it, expect } from "vitest";
import { expandRank } from "./cvRanks";

describe("expandRank", () => {
  it("expands agency deck codes", () => {
    expect(expandRank("MSTR")).toBe("Master");
    expect(expandRank("CO")).toBe("Chief Officer");
    expect(expandRank("2O")).toBe("2nd Officer");
    expect(expandRank("3O")).toBe("3rd Officer");
    expect(expandRank("J.OFF")).toBe("Junior Officer");
    expect(expandRank("D.CDT")).toBe("Deck Cadet");
  });
  it("expands engine codes with slashes", () => {
    expect(expandRank("2/E")).toBe("2nd Engineer");
  });
  it("keeps full titles unchanged", () => {
    expect(expandRank("Captain / Master")).toBe("Captain / Master");
  });
});
