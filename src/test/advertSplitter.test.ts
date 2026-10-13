import { describe, it, expect } from "vitest";
import { splitAdverts } from "@/lib/advertSplitter";

const A = "Need Chief Officer for Bulk Carrier\nContact a@one.com";
const B = "2/E urgent tanker\nWhatsApp +62 812 3456 7890";

describe("splitAdverts", () => {
  it("splits on explicit separator lines and trusts them", () => {
    const r = splitAdverts(`${A}\n---\n${B}`);
    expect(r).toHaveLength(2);
    expect(r.every((b) => !b.uncertain)).toBe(true);
    expect(r[0].text).toContain("a@one.com");
    expect(r[1].text).not.toContain("a@one.com");
  });

  it("splits on blank-line gaps but flags them for review", () => {
    const r = splitAdverts(`${A}\n\n\n${B}`);
    expect(r).toHaveLength(2);
    expect(r.every((b) => b.uncertain)).toBe(true);
  });

  it("keeps one advert when a gap piece has no contact", () => {
    expect(splitAdverts(`Header line\n\n\n${A}`)).toHaveLength(1);
  });

  it("flags a block with no contact", () => {
    const r = splitAdverts(`${A}\n===\nOiler needed`);
    expect(r[1].uncertain).toBe(true);
  });

  it("flags a block with two different emails as possibly merged", () => {
    expect(splitAdverts("Master a@x.com\nCook b@y.com")[0].uncertain).toBe(true);
  });

  it("returns nothing for empty input", () => {
    expect(splitAdverts("  \n ")).toEqual([]);
  });
});

describe("high-volume pastes", () => {
  it("has no 20-advert cap", () => {
    const many = Array.from({ length: 35 }, (_, i) => `Oiler ${i}\nContact c${i}@crew.com`).join("\n---\n");
    expect(splitAdverts(many)).toHaveLength(35);
  });
  it("splits Telegram export messages and keeps each contact with its advert", () => {
    const r = splitAdverts(`[13/10/2026 10:21] Agency One:\n${A}\n[13/10/2026 10:25] Agency Two:\n${B}`);
    expect(r).toHaveLength(2);
    expect(r[0].text).toContain("a@one.com");
    expect(r[1].text).not.toContain("a@one.com");
  });
  it("splits at contact envelopes separated by single blank lines, flagged", () => {
    const r = splitAdverts(`${A}\n\n${B}`);
    expect(r).toHaveLength(2);
    expect(r.every((b) => b.uncertain)).toBe(true);
  });
  it("keeps email and WhatsApp paragraphs of one advert together", () => {
    expect(splitAdverts("Master for VLCC\n\nEmail: m@x.com\n\nWA +62 812 3456 7890")).toHaveLength(1);
  });
});
