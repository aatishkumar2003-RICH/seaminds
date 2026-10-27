import { describe, it, expect } from "vitest";
import { buildDigests, vacanciesCsv, DIGEST_MAX_CHARS } from "@/lib/whatsappBroadcast";

const mk = (n: number) => Array.from({ length: n }, (_, i) => ({
  id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
  rank_required: `Chief Officer ${i}`, vessel_type: "Bulk Carrier", joining_port: "Singapore",
  recruiter_name: "PT. Benteng Marine Service", contact_whatsapp: "+6285219878989",
}));

describe("bulk WhatsApp digest", () => {
  it("puts all 50 vacancies in the broadcast, each exactly once", () => {
    const parts = buildDigests(mk(50));
    const all = parts.join("\n");
    for (let i = 0; i < 50; i++) expect(all.split(`CHIEF OFFICER ${i}*`).length - 1).toBe(1);
  });
  it("keeps every part within one WhatsApp message length", () => {
    for (const p of buildDigests(mk(50))) expect(p.length).toBeLessThanOrEqual(DIGEST_MAX_CHARS);
  });
  it("uses a single message for a small batch", () => {
    expect(buildDigests(mk(3))).toHaveLength(1);
  });
  it("exports one spreadsheet row per vacancy", () => {
    expect(vacanciesCsv(mk(50)).split("\r\n")).toHaveLength(51);
  });
});
