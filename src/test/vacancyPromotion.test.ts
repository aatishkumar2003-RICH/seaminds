import { describe, it, expect } from "vitest";
import { promotionCost, pickSponsored, type SponsoredRow } from "@/lib/vacancyPromotion";
import { rankHubBySlug } from "@/lib/jobSlug";

describe("promotion pricing", () => {
  it("fleet: 5 credits for 10 vacancies, 10 credits for 20", () => {
    expect(promotionCost("fleet", 10)).toBe(5);
    expect(promotionCost("fleet", 20)).toBe(10);
  });
  it("urgent: 5 credits for 5 vacancies", () => {
    expect(promotionCost("urgent", 5)).toBe(5);
    expect(promotionCost("urgent", 6)).toBe(10);
  });
});

const row = (id: string, rank: string, mgr: string, rotation: number): SponsoredRow => ({
  posting_id: id, campaign: "fleet", rank_required: rank, vessel_type: null, company_name: "X", recruiter_name: null,
  joining_port: null, monthly_salary: null, manager_id: mgr, rotation,
});

describe("rank-targeted rotation", () => {
  it("shows only the crew's rank and one slot per recruiter", () => {
    const rows = [row("a", "Chief Officer", "m1", 1), row("b", "AB", "m2", 2), row("c", "Chief Officer", "m1", 3), row("d", "Chief Officer", "m3", 4)];
    expect(pickSponsored(rows, rankHubBySlug("chief-officer")).map((r) => r.posting_id)).toEqual(["a", "d"]);
  });
});
