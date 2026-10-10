import { describe, it, expect } from "vitest";
import { resolveApplyRoute } from "@/lib/applicationRouter";
import type { UnifiedVacancy } from "@/lib/vacancyFeed";

const base: UnifiedVacancy = {
  id: "1", kind: "direct", rank: "Chief Officer", vessel: "Tanker", port: null, joiningDate: null,
  contractDuration: null, salaryText: null, company: "PT ABC Crewing", publisherName: "Seaminds.life",
  verified: false, qualityScore: null, postedAt: null, expiresAt: null, notes: null, email: null,
  whatsapp: null, applyUrl: null, positions: 1, flierUrl: null, postingBatchId: null, source: null, isNew: false,
};

describe("application routing", () => {
  it("SeaMinds-imported flyer with WhatsApp opens WhatsApp", () => {
    expect(resolveApplyRoute({ ...base, whatsapp: "+6281234567890" }, null).channel).toBe("whatsapp");
  });
  it("SeaMinds-imported flyer with only email routes to recruiter email", () => {
    expect(resolveApplyRoute({ ...base, email: "hr@abc.co.id" }, null).channel).toBe("email");
  });
  it("SeaMinds-imported flyer with no contact shows the flyer and records nothing", () => {
    const r = resolveApplyRoute({ ...base, flierUrl: "https://x/f.jpg" }, null);
    expect(r.channel).toBe("flyer");
    expect(r.record).toBe(false);
  });
  it("registered employer posting goes to the SeaMinds dashboard", () => {
    expect(resolveApplyRoute({ ...base, publisherName: "Synergy Marine", whatsapp: "+6512345678" }, null).channel).toBe("seaminds");
  });
  it("external listing prefers WhatsApp over aggregator link", () => {
    expect(resolveApplyRoute({ ...base, kind: "external", publisherName: null, applyUrl: "https://agg", whatsapp: "+6281234567890" }, null).channel).toBe("whatsapp");
  });
});

import { hasSecondaryEmail } from "@/lib/applicationRouter";
describe("secondary email option", () => {
  it("offered when WhatsApp is primary and an email exists", () => {
    expect(hasSecondaryEmail({ ...base, whatsapp: "+6281234567890", email: "hr@abc.co.id" })).toBe(true);
  });
  it("not offered when email is already the primary channel", () => {
    expect(hasSecondaryEmail({ ...base, email: "hr@abc.co.id" })).toBe(false);
  });
  it("not offered for registered employers (SeaMinds dashboard)", () => {
    expect(hasSecondaryEmail({ ...base, publisherName: "Synergy Marine", whatsapp: "+6512345678", email: "a@b.c" })).toBe(false);
  });
});
