import { describe, it, expect } from "vitest";
import { filterItems, buildRfqText } from "@/lib/marketplaceExchange";

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
  it("includes vessel, port and quantity", () => {
    const t = buildRfqText({ title: "Seal kit", origin_country: "Singapore" }, { vessel: "MT A", imo: "9482103", port: "Singapore", quantity: "2" });
    expect(t).toContain("IMO 9482103");
    expect(t).toContain("Quantity: 2");
  });
});
