import { supabase } from "@/integrations/supabase/client";

export type ConsentRole = "crew" | "manager";
/** Bump to re-ask every user once after the wording changes. */
export const CONSENT_VERSION = "2026.1";

export const consentCacheKey = (uid: string, role: ConsentRole, version = CONSENT_VERSION) =>
  `seaminds_consent_${role}_${version}_${uid}`;

/** True when this user already accepted this role's current agreement. Fails open on network errors so login never blocks offline. */
export async function hasAcceptedConsent(uid: string, role: ConsentRole): Promise<boolean> {
  try { if (localStorage.getItem(consentCacheKey(uid, role))) return true; } catch { /* storage blocked */ }
  const { data, error } = await (supabase as any)
    .from("user_legal_consents").select("id")
    .eq("user_id", uid).eq("role", role).eq("consent_version", CONSENT_VERSION).maybeSingle();
  if (error) return true;
  if (data) { try { localStorage.setItem(consentCacheKey(uid, role), "1"); } catch { /* ignore */ } }
  return !!data;
}

export async function recordConsent(uid: string, role: ConsentRole): Promise<void> {
  const { error } = await (supabase as any).from("user_legal_consents").insert({
    user_id: uid, role, consent_version: CONSENT_VERSION,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
  });
  // 23505 = already accepted (another tab) — treat as success
  if (error && error.code !== "23505") throw error;
  try { localStorage.setItem(consentCacheKey(uid, role), "1"); } catch { /* ignore */ }
}

export const CONSENT_TEXT: Record<ConsentRole, { title: string; subtitle: string; button: string; points: { h: string; b: string }[] }> = {
  crew: {
    title: "Welcome to SeaMinds",
    subtitle: "Your connection platform for maritime careers and skills.",
    button: "Confirm & Continue",
    points: [
      { h: "Connecting platform only", b: "SeaMinds provides digital tools to build your profile, prepare for interviews and discover vacancies. We are not an employer or crewing agency." },
      { h: "Applications go to the company", b: "When you apply, your CV and details are forwarded to the hiring company as per your profile. Further engagement, contracts and how that company handles your data are solely between you and them." },
      { h: "Your documents, your responsibility", b: "You confirm your certificates, sea time and qualifications are genuine and accurate. Final verification is the responsibility of you and the hiring company before engagement." },
      { h: "No employment fees (MLC 2006)", b: "In line with international maritime law, SeaMinds never charges seafarers for recruitment, placement or securing a contract. Optional credits or tools relate only to software features." },
    ],
  },
  manager: {
    title: "ShipManager Terms of Use",
    subtitle: "Candidate introductions & verification.",
    button: "Confirm & Access Portal",
    points: [
      { h: "Introduction platform only", b: "SeaMinds connects you with seafarers. We are not an employer, crewing agent or guarantor of any candidate." },
      { h: "Your verification duty", b: "Profiles and documents are submitted by seafarers. Verifying original certificates, STCW compliance, sea service and medical fitness before engagement is solely your company's responsibility." },
      { h: "Responsible data use", b: "Candidate information is used only for legitimate maritime recruitment, under applicable data protection laws and MLC 2006." },
      { h: "No fees to seafarers", b: "Your company will not charge seafarers introduced through SeaMinds any recruitment or placement fee (MLC 2006 Standard A1.4)." },
    ],
  },
};
