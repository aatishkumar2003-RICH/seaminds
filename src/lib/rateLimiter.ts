import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function checkRateLimit(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("check-rate-limit");

    if (error) {
      console.warn("[SeaMinds] Rate limit check failed, allowing attempt:", error);
      return true; // fail open
    }

    if (!data.allowed) {
      toast.error(data.error || "Too many login attempts. Please try again later.");
      return false;
    }

    return true;
  } catch (e) {
    console.warn("[SeaMinds] Rate limit check error:", e);
    return true; // fail open
  }
}
