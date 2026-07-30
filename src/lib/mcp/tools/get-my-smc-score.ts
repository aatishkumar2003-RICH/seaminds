import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, notAuthenticated, textResult, errorResult } from "../supabaseClient";

export default defineTool({
  name: "get_my_smc_score",
  title: "Get my SMC score",
  description: "Return the signed-in seafarer's latest Seafarer Merit Score (SMC) assessment result and dimension scores.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const supabase = supabaseForUser(ctx);
    const { data: profile, error: pErr } = await supabase
      .from("crew_profiles")
      .select("id")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (pErr) return errorResult(pErr.message);
    if (!profile) return errorResult("No crew profile found for this account yet.");

    const { data, error } = await supabase
      .from("smc_assessments")
      .select(
        "id, status, overall_score, score_band, technical_score, english_score, experience_score, behavioural_score, wellness_score, dimension_scores, certificate_id, recommendation, completed_at"
      )
      .eq("crew_profile_id", profile.id)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!data) return errorResult("No SMC assessment found yet.");
    return textResult(data);
  },
});
