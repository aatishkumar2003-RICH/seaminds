import { describe, it, expect } from "vitest";
import { listingCost, missingRequired, SHIP_PHOTO_SLOTS, SPARE_SPEC, SPARE_PHOTO_SLOTS } from "./marketplaceSpecs";

const w = { ship: 25, spare: 5, service: 10 };
describe("marketplace listing rules", () => {
  it("ship listing costs 25 credits", () => expect(listingCost("ship", w)).toBe(25));
  it("spare listing costs 5 credits", () => expect(listingCost("spares", w)).toBe(5));
  it("ship listing allows 18 photos", () => expect(SHIP_PHOTO_SLOTS.length).toBe(18));
  it("spare listing requires the maker nameplate photo", () => {
    const spec = { system: "Main engine", machine_model: "6S50ME-C", part_name: "Spindle", class_cert: "DNV" };
    expect(missingRequired(SPARE_SPEC, spec, SPARE_PHOTO_SLOTS, { surface: 1 })).toEqual(["Photo: Maker nameplate / stamping"]);
  });
});
