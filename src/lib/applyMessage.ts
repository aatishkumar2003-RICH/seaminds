import { supabase } from "@/integrations/supabase/client";

export interface CrewCardInfo {
  firstName: string;
  role: string;
  yearsInRankBand: string;
  token: string;
  score: number | null;
  band: string | null;
  certificateId: string | null;
}

/** Loads the signed-in crew's calling-card data (token + latest completed score). */
export const fetchCrewCardInfo = async (profileId: string): Promise<CrewCardInfo | null> => {
  if (!profileId) return null;
  try {
    const [{ data: prof }, { data: sc }] = await Promise.all([
      supabase.from("crew_profiles")
        .select("first_name, rank, role, years_in_rank_band, public_card_token" as any)
        .eq("id", profileId).maybeSingle(),
      supabase.from("smc_assessments")
        .select("overall_score, score_band, certificate_id")
        .eq("crew_profile_id", profileId).eq("status", "completed")
        .order("completed_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const p: any = prof || {};
    if (!p.public_card_token) return null;
    const s: any = sc || {};
    return {
      firstName: p.first_name || "",
      role: p.rank || p.role || "",
      yearsInRankBand: p.years_in_rank_band || "",
      token: p.public_card_token,
      score: s.overall_score != null ? Number(s.overall_score) : null,
      band: s.score_band || null,
      certificateId: s.certificate_id || null,
    };
  } catch {
    return null;
  }
};

export interface ApplyVacancyInfo {
  rank?: string | null;
  vessel?: string | null;
  port?: string | null;
}

/** Builds the SeaMinds calling-card WhatsApp message (plain text, not encoded). */
export const buildApplyMessage = (info: CrewCardInfo | null, v: ApplyVacancyInfo): string => {
  const position = `${v.rank || "Crew"} — ${v.vessel || "Vessel"}${v.port ? `, ${v.port}` : ""}`;
  const lines = ["⚓ Application via SeaMinds", "", `Position: ${position}`];

  if (info) {
    lines.push(
      "",
      `Candidate: ${info.firstName}${info.role ? ` — ${info.role}` : ""}${info.yearsInRankBand ? `, ${info.yearsInRankBand} in rank` : ""}`,
      "",
      `Verified Sea Profile: https://seaminds.life/crew/${info.token}`,
    );
    if (info.score != null && info.certificateId) {
      lines.push(
        "",
        `SeaMinds Score: ${info.score.toFixed(2)}${info.band ? ` (${info.band})` : ""} — verify: https://seaminds.life/verify/${info.certificateId}`,
      );
    }
  }

  lines.push("", "Sent via SeaMinds — seaminds.life · free crew platform, no agent fees");
  return lines.join("\n");
};

/** WhatsApp deep link carrying the calling-card message. */
export const waApplyLink = (
  number: string | null | undefined,
  info: CrewCardInfo | null,
  v: ApplyVacancyInfo,
): string | null => {
  const digits = String(number || "").replace(/[^\d]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(buildApplyMessage(info, v))}`;
};
