import { describe, it, expect } from "vitest";
import { originOf } from "@/lib/vacancyOrigin";
describe("originOf", () => {
  it("Indonesia incl. domestic 08", () => { expect(originOf("+62 812")).toBe("id"); expect(originOf("0812-345")).toBe("id"); });
  it("India", () => expect(originOf("+91 98")).toBe("in"));
  it("Ukraine", () => expect(originOf("380501234567")).toBe("ua"));
  it("Russia needs +7 or 11 digits", () => { expect(originOf("+7 912")).toBe("ru"); expect(originOf("79123456789")).toBe("ru"); expect(originOf("7912")).toBeNull(); });
  it("unknown/empty", () => { expect(originOf("+44 20")).toBeNull(); expect(originOf(null)).toBeNull(); });
});
