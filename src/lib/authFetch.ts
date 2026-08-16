import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Headers for direct fetch() calls to edge functions (streaming cases where
 * supabase.functions.invoke doesn't fit). Sends the signed-in user's JWT.
 */
export async function authedFunctionHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || "";
  return {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  };
}

/** Show a friendly re-auth toast for 401 responses. Returns true if it was a 401. */
export function handleAuthError(status: number): boolean {
  if (status === 401) {
    toast.error("Please sign in again to continue.");
    return true;
  }
  return false;
}
