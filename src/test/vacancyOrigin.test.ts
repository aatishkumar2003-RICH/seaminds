import { describe, it, expect } from "vitest";
import { originOf } from "@/lib/vacancyOrigin";
describe("originOf", () => {
  it("Indonesia incl. domestic 08", () => { expect(originOf("+62 812")).toBe("id"); expect(originOf("0812-345")).toBe("id"); });
  it("India", () => expect(originOf("+91 98")).toBe("in"));
  it("Ukraine", () => expect(originOf("380501234567")).toBe("ua"));
  it("Russia needs +7 or 11 digits", () => { expect(originOf("+7 912")).toBe("ru"); expect(originOf("79123456789")).toBe("ru"); expect(originOf("7912")).toBeNull(); });
  it("unknown/empty", () => { expect(originOf(null)).toBeNull(); });
});
describe("originOf hubs", () => {
  it("European & other hubs", () => {
    expect(originOf("+30 210")).toBe("gr"); expect(originOf("+357 99")).toBe("cy");
    expect(originOf("+49 40")).toBe("de"); expect(originOf("+44 20")).toBe("gb");
    expect(originOf("+90 532")).toBe("tr"); expect(originOf("+1 305")).toBe("us");
    expect(originOf("+971 50")).toBe("ae"); expect(originOf("+880 17")).toBe("bd");
  });
  it("unknown code stays null", () => expect(originOf("+254 7")).toBeNull());
});
