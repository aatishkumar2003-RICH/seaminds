import { describe, it, expect } from "vitest";
import { resolveNationality, manningStatus } from "@/lib/crewManning";

const now = new Date("2026-10-29T00:00:00Z");

describe("resolveNationality", () => {
  it("uses declared nationality first", () => {
    expect(resolveNationality({ nationality: "Indian", whatsapp_number: "+84123" }).name).toBe("India");
  });
  it("falls back to WhatsApp dial code", () => {
    expect(resolveNationality({ whatsapp_number: "+84947738883" }).name).toBe("Vietnam");
    expect(resolveNationality({ whatsapp_number: "+380501234567" }).name).toBe("Ukraine");
  });
  it("returns Unknown when nothing is known", () => {
    expect(resolveNationality({}).name).toBe("Unknown");
  });
});

describe("manningStatus", () => {
  it("placed crew are on board", () => {
    expect(manningStatus({ placed_until: "2027-01-01", is_available: true }, now)).toBe("onboard");
  });
  it("future availability date is available soon", () => {
    expect(manningStatus({ available_from: "2026-11-15", is_available: true }, now)).toBe("soon");
  });
  it("available crew are ready to join", () => {
    expect(manningStatus({ is_available: true }, now)).toBe("ready");
  });
  it("otherwise not available", () => {
    expect(manningStatus({ is_available: false }, now)).toBe("unavailable");
  });
});
