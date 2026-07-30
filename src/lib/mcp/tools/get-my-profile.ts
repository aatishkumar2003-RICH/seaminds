import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, notAuthenticated, textResult, errorResult } from "../supabaseClient";

export default defineTool({
  name: "get_my_profile",
  title: "Get my crew profile",
  description: "Return the signed-in seafarer's SeaMinds crew profile: name, rank, nationality, vessel, availability and crew ID.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const { data, error } = await supabaseForUser(ctx)
      .from("crew_profiles")
      .select(
        "id, first_name, last_name, rank, role, nationality, home_country, ship_name, vessel_type, years_at_sea, crew_unique_id, is_available, available_from, job_alerts_enabled, onboarding_complete"
      )
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!data) return errorResult("No crew profile found for this account yet.");
    return textResult(data);
  },
});
