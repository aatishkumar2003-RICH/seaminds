import { describe, it, expect } from "vitest";
import { rankMatches } from "./RankCrewPicker";
describe("rankMatches", () => {
  it("matches spelled-out ranks", () => expect(rankMatches("Second Engineer", "2nd Engineer")).toBe(true));
  it("does not mix 2nd Engineer with Chief Engineer", () => expect(rankMatches("Chief Engineer", "2nd Engineer")).toBe(false));
  it("treats Deck Cadet as Cadet", () => expect(rankMatches("Cadet", "Deck Cadet")).toBe(true));
  it("never mixes Deck Cadet with Engine Cadet", () => { expect(rankMatches("Engine Cadet", "Deck Cadet")).toBe(false); expect(rankMatches("Deck Cadet", "Engine Cadet")).toBe(false); });
});
