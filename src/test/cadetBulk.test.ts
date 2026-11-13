import { describe, it, expect } from "vitest";
import { parseCadetTable, parseCadetText } from "@/lib/cadetBulk";
describe("cadet bulk parsing", () => {
  it("reads headed Excel tables", () => {
    const r = parseCadetTable([["Name", "Email", "Rank", "Vessel"], ["Van A", "A@x.com", "Engine Cadet", "MV Star"], ["Van B", "b@x.com", "Deck Cadet", ""]]);
    expect(r).toEqual([{ email: "a@x.com", name: "Van A", track: "engine", vessel: "MV Star" }, { email: "b@x.com", name: "Van B", track: "deck", vessel: "" }]);
  });
  it("reads pasted lines, skips duplicates and lines without email", () => {
    const r = parseCadetText("c1@g.com, Nguyen A, Engine Cadet, MV Pacific\nno email here\nc1@g.com, dup\nTran B c2@g.com");
    expect(r.map((x) => [x.email, x.track])).toEqual([["c1@g.com", "engine"], ["c2@g.com", "deck"]]);
    expect(r[0].name).toBe("Nguyen A"); expect(r[0].vessel).toBe("MV Pacific");
  });
});
