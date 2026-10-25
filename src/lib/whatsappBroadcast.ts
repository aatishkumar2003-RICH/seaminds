import { jobPath } from "@/lib/jobSlug";

export type BroadcastVacancy = {
  id: string;
  rank_required?: string | null;
  vessel_type?: string | null;
  joining_port?: string | null;
  joining_date?: string | null;
  monthly_salary?: string | null;
  contract_duration?: string | null;
  [k: string]: unknown;
};

const ORIGIN = "https://seaminds.life";

export const vacancyUrl = (v: BroadcastVacancy) =>
  ORIGIN + jobPath({ id: v.id, rank: v.rank_required, vessel: v.vessel_type, port: v.joining_port });

/** Plain-text maritime announcement for WhatsApp channels/groups. */
export const broadcastText = (v: BroadcastVacancy) => {
  const lines = [
    `⚓ *VACANCY: ${(v.rank_required || "Seafarer").toUpperCase()}*`,
    v.vessel_type && `🚢 Vessel: ${v.vessel_type}`,
    v.monthly_salary && `💰 Wage: ${v.monthly_salary}`,
    v.joining_date && `📅 Joining: ${v.joining_date}`,
    v.joining_port && `📍 Port: ${v.joining_port}`,
    v.contract_duration && `⏳ Contract: ${v.contract_duration}`,
    "",
    `👉 Apply: ${vacancyUrl(v)}`,
    "",
    "Shared via SeaMinds — free for seafarers.",
  ];
  return lines.filter((l): l is string => typeof l === "string").join("\n");
};

export const whatsappShareUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
