import { supabase } from "@/integrations/supabase/client";

export type AssessmentMode = "PROFILE" | "CV_BASED";

export interface GatewayResult {
  ok: boolean;
  action?: "start" | "resume";
  assessment_id?: string;
  mode?: AssessmentMode;
  context_id?: string;
  round?: number;
  error?: string;
}

const parse = (d: unknown) => (typeof d === "string" ? JSON.parse(d) : d) as GatewayResult | null;

/** True when the server function does not exist yet (migration not applied). */
const isMissingFn = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message || ""));

/**
 * Single client entry point for creating or resuming an assessment.
 * Uses open_assessment_v2 (explicit mode + server-derived context).
 * TRANSITION ONLY: falls back to the legacy server paths while the v4
 * migration is not yet applied. Remove the fallback after Stage A ships.
 */
export async function openAssessmentV2(
  mode: AssessmentMode,
  opts: { inviteId?: string | null; restart?: boolean; crewId?: string } = {},
): Promise<GatewayResult> {
  const { data, error } = await (supabase.rpc as any)("open_assessment_v2", {
    p_mode: mode,
    p_invite_id: opts.inviteId ?? null,
    p_restart: !!opts.restart,
  });
  if (!error) return parse(data) ?? { ok: false, error: "EMPTY_RESPONSE" };
  if (!isMissingFn(error)) return { ok: false, error: error.message };

  // ---- legacy fallback: ONLY reachable before Stage A exists ----
  // After Stage A the function exists (so this never runs) and the database
  // rejects any direct client insert with ASSESSMENT_GATEWAY_REQUIRED.
  if (opts.inviteId) {
    if (!opts.crewId) return { ok: false, error: "AUTH_REQUIRED" };
    const { data: created, error: cErr } = await supabase
      .from("smc_assessments")
      .insert({ crew_profile_id: opts.crewId, status: "in_progress", current_step: 1 } as any)
      .select("id")
      .single();
    if (cErr) return { ok: false, error: cErr.message };
    return { ok: true, action: "start", assessment_id: created.id };
  }
  if (opts.restart && opts.crewId) {
    await supabase.from("smc_assessments").update({ status: "abandoned" })
      .eq("crew_profile_id", opts.crewId).eq("status", "in_progress");
  }
  const legacy = await (supabase.rpc as any)("start_or_resume_assessment");
  if (legacy.error) return { ok: false, error: legacy.error.message };
  return parse(legacy.data) ?? { ok: false, error: "EMPTY_RESPONSE" };
}

/** Human message for gateway error codes. */
export function gatewayErrorMessage(code?: string): string {
  switch (code) {
    case "NEED_RANK": return "Please set your official rank in your profile before starting.";
    case "CV_REQUIRED": return "Upload your CV first to take the CV-Based Score.";
    case "INVITE_NOT_YOURS": return "This invitation belongs to a different account.";
    case "CAMPAIGN_CLOSED": return "This interview is closed.";
    case "ROUND2_REQUIRES_CV_BASED": return "This round is a CV-Based assessment.";
    case "ROUND1_ALREADY_EXISTS":
    case "ROUND2_ALREADY_EXISTS": return "This interview has already been taken. Your saved result is kept.";
    default:
      if (code && code.includes("ASSESSMENT_GATEWAY_REQUIRED")) return "Please refresh the SeaMinds app and try again.";
      return code || "Could not start the assessment";
  }
}
