import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, textResult, errorResult } from "../supabaseClient";

export default defineTool({
  name: "update_availability",
  title: "Update my availability",
  description: "Update the signed-in seafarer's availability for work, available-from date and job alert preference.",
  inputSchema: {
    is_available: z.boolean().optional().describe("Whether the seafarer is currently available for work."),
    available_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Date available from, YYYY-MM-DD."),
    job_alerts_enabled: z.boolean().optional().describe("Whether to receive job alerts."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    if (Object.keys(patch).length === 0) return errorResult("Provide at least one field to update.");

    const { data, error } = await supabaseForUser(ctx)
      .from("crew_profiles")
      .update(patch)
      .eq("user_id", ctx.getUserId())
      .select("is_available, available_from, job_alerts_enabled");
    if (error) return errorResult(error.message);
    if (!data?.length) return errorResult("No crew profile found to update.");
    return textResult(data[0]);
  },
});
