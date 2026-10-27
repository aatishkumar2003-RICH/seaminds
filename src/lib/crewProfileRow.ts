import { supabase } from "@/integrations/supabase/client";

export type EnsureResult = "ok" | "manager" | "signed_out" | "error";

/**
 * Self-heal: make sure the signed-in seafarer has a crew_profiles row before saving.
 * Signup can skip it (manager metadata, swallowed trigger errors); an UPDATE on a
 * missing row silently changes nothing. Manager accounts are never turned into crew.
 */
export const ensureCrewProfileRow = async (): Promise<EnsureResult> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "signed_out";
  const { data: row, error } = await supabase.from("crew_profiles").select("id").eq("id", user.id).maybeSingle();
  if (error) return "error";
  if (row) return "ok";
  // Dual role allowed: ship managers (often seafarers on leave) may also keep a Sea Profile.
  const meta: any = user.user_metadata || {};
  const email = user.email || "";
  const { error: insErr } = await supabase.from("crew_profiles").insert({
    id: user.id,
    first_name: meta.first_name || meta.given_name || (email.split("@")[0] || "Seafarer"),
    last_name: meta.last_name || meta.family_name || "",
    role: "Seafarer",
    ship_name: "Not on vessel",
    nationality: meta.nationality || "",
    onboarding_complete: false,
  } as any);
  if (insErr && !/duplicate/i.test(insErr.message)) return "error";
  return "ok";
};

export const MANAGER_ACCOUNT_MSG = "This is a company account. Sign in with your seafarer account to save a Sea Profile.";
