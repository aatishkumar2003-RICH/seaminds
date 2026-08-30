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

const cardCache = new Map<string, Promise<CrewCardInfo | null>>();
let lastCard: CrewCardInfo | null = null;

/** Synchronously returns the last successfully loaded card (no network). */
export const getCachedCrewCardInfo = (): CrewCardInfo | null => lastCard;

/** Loads the signed-in crew's calling-card data (token + latest completed score), cached per profile. */
export const fetchCrewCardInfo = async (profileId: string): Promise<CrewCardInfo | null> => {
  if (!profileId) return null;
  const hit = cardCache.get(profileId);
  if (hit) return hit;
  const p = loadCrewCardInfo(profileId).then((v) => {
    if (v) lastCard = v;
    else cardCache.delete(profileId);
    return v;
  }).catch(() => { cardCache.delete(profileId); return null; });
  cardCache.set(profileId, p);
  return p;
};

const loadCrewCardInfo = async (profileId: string): Promise<CrewCardInfo | null> => {

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
      `View my full Sea Profile (free company registration): https://seaminds.life/crew/${info.token}`,
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

/** Normalizes a phone number for wa.me: digits only, no leading zeros. Null when too short. */
export const normalizeWaNumber = (number: string | null | undefined): string | null => {
  const digits = String(number || "").replace(/[^\d]/g, "").replace(/^0+/, "");
  return digits.length >= 8 ? digits : null;
};

/** WhatsApp deep link carrying the calling-card message. */
export const waApplyLink = (
  number: string | null | undefined,
  info: CrewCardInfo | null,
  v: ApplyVacancyInfo,
): string | null => {
  const digits = normalizeWaNumber(number);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(buildApplyMessage(info, v))}`;
};

export interface RecordApplyArgs {
  vacancyId?: string | null;
  jobPostingId?: string | null;
  companyPostId?: string | null;
  company?: string | null;
  rank?: string | null;
  vessel?: string | null;
  externalUrl?: string | null;
}

export interface RecordApplyResult {
  ok: boolean;
  duplicate: boolean;
  applicationId?: string;
  /** True only when the notify-application call reported an accepted delivery. */
  emailSent?: boolean;
  /** Safe, short reason when the email attempt did not succeed. */
  emailReason?: string;
}

/**
 * Records the application, then awaits the notification email attempt before
 * reporting back. A failed email never undoes the recorded application.
 * Duplicates never trigger another automatic email.
 */
export const recordApplication = (
  a: RecordApplyArgs,
  cb?: (r: RecordApplyResult) => void,
): void => {
  const done = (r: RecordApplyResult) => { try { cb?.(r); } catch { /* noop */ } };
  const fail = () => done({ ok: false, duplicate: false });

  const notify = async (applicationId: string): Promise<{ emailSent: boolean; emailReason?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke("notify-application", {
        body: { application_id: applicationId, kind: "application" },
      });
      if (error) return { emailSent: false, emailReason: String(error.message || "send_failed").slice(0, 120) };
      const r = data as { ok?: boolean; sent?: boolean; attempts?: { skipped?: string; error?: string }[] } | null;
      if (r?.ok && r?.sent === true) return { emailSent: true };
      const at = r?.attempts?.[0];
      return { emailSent: false, emailReason: at?.skipped || at?.error || "not_sent" };
    } catch {
      return { emailSent: false, emailReason: "network_error" };
    }
  };

  const run = async () => {
    let res: any;
    try {
      res = await supabase.rpc("submit_application" as any, {
        p_vacancy_id: a.vacancyId || null,
        p_company_post_id: a.companyPostId || null,
        p_job_posting_id: a.jobPostingId || null,
        p_company_name: a.company || null,
        p_rank: a.rank || null,
        p_vessel: a.vessel || null,
        p_external_url: a.externalUrl || null,
      });
    } catch {
      fail();
      return;
    }
    const r: any = res?.data || {};
    if (res?.error || !r?.ok) { fail(); return; }

    if (r.application_id && !r.duplicate) {
      const e = await notify(r.application_id);
      done({ ok: true, duplicate: false, applicationId: r.application_id, ...e });
      return;
    }
    done({ ok: true, duplicate: !!r.duplicate, applicationId: r.application_id });
  };

  void run();
};

const quickProfileCache = new Map<string, boolean>();

/** True when the crew's Quick Sea Profile is complete. Resolve on mount, never on tap. */
export const fetchQuickProfileDone = async (profileId: string): Promise<boolean> => {
  if (!profileId) return false;
  const hit = quickProfileCache.get(profileId);
  if (hit !== undefined) return hit;
  try {
    const { data } = await supabase
      .from("crew_profiles")
      .select("quick_profile_completed_at" as any)
      .eq("id", profileId)
      .maybeSingle();
    const done = !!(data as any)?.quick_profile_completed_at;
    quickProfileCache.set(profileId, done);
    return done;
  } catch {
    return true; // never block applying on a lookup failure
  }
};

