import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, textResult, errorResult } from "../supabaseClient";

export default defineTool({
  name: "search_jobs",
  title: "Search maritime jobs",
  description: "Search current maritime job vacancies on SeaMinds by rank, vessel type or free-text keyword.",
  inputSchema: {
    query: z.string().trim().optional().describe("Free-text keyword matched against job title and description."),
    rank: z.string().trim().optional().describe("Rank required, e.g. '2nd Officer', 'ETO Cadet'."),
    vessel_type: z.string().trim().optional().describe("Vessel type, e.g. 'Tanker', 'Bulk Carrier'."),
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of vacancies to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, rank, vessel_type, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    let q = supabaseForUser(ctx)
      .from("external_vacancies")
      .select(
        "id, title, rank_required, vessel_type, company_name, salary_text, salary_min, salary_max, joining_port, joining_date, contract_duration, apply_url, contact_email, contact_whatsapp, quality_score, fetched_at"
      )
      .eq("is_scam_flagged", false).gt("expires_at", new Date().toISOString())
      .order("fetched_at", { ascending: false })
      .limit(limit ?? 10);

    if (rank) q = q.ilike("rank_required", `%${rank}%`);
    if (vessel_type) q = q.ilike("vessel_type", `%${vessel_type}%`);
    if (query) q = q.or(`title.ilike.%${query}%,description.ilike.%${query}%`);

    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return textResult({ count: data?.length ?? 0, vacancies: data ?? [] });
  },
});
