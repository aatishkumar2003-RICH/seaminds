import { describe, it, expect } from "vitest";
import { filterItems, buildRfqText, buildInquiryPayload } from "@/lib/marketplaceExchange";

const base = { maker: null, part_number: null, company: "X", description: null, stock_ports: ["Singapore"], condition: "new_oem" };
const rows = [
  { ...base, title: "Viton O-ring", origin_country: "China", stock_ports: ["Ningbo"] },
  { ...base, title: "O-ring kit", origin_country: "Japan" },
  { ...base, title: "Piston ring", origin_country: "Japan" },
];
const all = { q: "", origin: "All", port: "All", condition: "All" };

describe("marketplace filters", () => {
  it("searches O-ring across origins", () => expect(filterItems(rows, { ...all, q: "o-ring" })).toHaveLength(2));
  it("filters by country of origin", () => expect(filterItems(rows, { ...all, q: "o-ring", origin: "Japan" }).map((r) => r.title)).toEqual(["O-ring kit"]));
  it("filters by stock port", () => expect(filterItems(rows, { ...all, port: "Ningbo" })).toHaveLength(1));
});

describe("RFQ text", () => {
  it("supports shore procurement without vessel or IMO", () => {
    const t = buildRfqText({ title: "Seal kit", origin_country: "Singapore" }, { company: "Shore Trading", port: "Singapore warehouse", quantity: "5 sets" });
    expect(t).toContain("Buyer / company: Shore Trading");
    expect(t).toContain("Delivery: Singapore warehouse");
    expect(t).toContain("Quantity: 5 sets");
    expect(t).not.toMatch(/Vessel:|IMO/);
  });
  it("preserves buyer identity and specifications in online inquiries", () => {
    expect(buildInquiryPayload({ company: "Shore Trading", notes: "Viton, 20 mm", port: "Batam workshop", quantity: "20 pieces" })).toEqual({
      port: "Batam workshop", quantity: "20 pieces", needed_by: undefined, notes: "Buyer / company: Shore Trading\nViton, 20 mm",
    });
  });
  it("does not require a company or vessel reference", () => {
    expect(buildInquiryPayload({ quantity: "2" })).toEqual({ port: undefined, quantity: "2", needed_by: undefined, notes: "" });
  });
});
