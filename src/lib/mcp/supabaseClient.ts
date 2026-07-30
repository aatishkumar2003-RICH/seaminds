import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/** Supabase client bound to the calling user's verified token (RLS runs as that user). */
export function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const notAuthenticated = {
  content: [{ type: "text" as const, text: "Not authenticated." }],
  isError: true,
};

export const textResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

export const errorResult = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true,
});
