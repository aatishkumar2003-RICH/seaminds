import { rankMatches, type RankHub } from "@/lib/jobSlug";

export type Campaign = "urgent" | "fleet";

/** Mirrors SQL promote_vacancies: urgent 48h = 5 credits per 5 vacancies, fleet 7 days = 5 credits per 10. */
export const CAMPAIGNS: Record<Campaign, { label: string; hours: number; perBlock: number; credits: number; blurb: string }> = {
  urgent: { label: "🚨 Urgent", hours: 48, perBlock: 5, credits: 5, blurb: "Top of the rank feed for 48 hours" },
  fleet: { label: "⭐ Fleet", hours: 168, perBlock: 10, credits: 5, blurb: "Featured in rotation for 7 days" },
};

export const promotionCost = (campaign: Campaign, count: number): number => {
  if (count <= 0) return 0;
  const c = CAMPAIGNS[campaign];
  return c.credits * Math.ceil(count / c.perBlock);
};

export interface SponsoredRow {
  posting_id: string;
  campaign: Campaign;
  rank_required: string | null;
  vessel_type: string | null;
  company_name: string | null;
  recruiter_name: string | null;
  joining_port: string | null;
  monthly_salary: string | null;
  manager_id: string;
  rotation: number;
}

/** Rows arrive in server rotation order. Keep only the crew's rank and at most one per manager, so no agency floods the top. */
export const pickSponsored = (rows: SponsoredRow[], hub: RankHub | null, limit = 3): SponsoredRow[] => {
  const seen = new Set<string>();
  const out: SponsoredRow[] = [];
  for (const r of [...rows].sort((a, b) => a.rotation - b.rotation)) {
    if (hub && !rankMatches(hub, r.rank_required)) continue;
    if (seen.has(r.manager_id)) continue;
    seen.add(r.manager_id);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
};
