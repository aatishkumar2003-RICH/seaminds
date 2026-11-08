export type HelpAudience = "manager" | "marketplace" | "crew";

const CREW_JOURNEY = ["/feed", "/quick-profile", "/profile", "/profile-start"];
const COMPANY_PUBLIC = ["/for-companies", "/pricing", "/contact"];

/** Where the floating DORA button appears. Never over exams, training or the private crew app. */
export function businessHelpAudience(path: string): HelpAudience | null {
  if (/^\/marketplace(?:\/|$)/.test(path)) return "marketplace";
  if (/^\/manager(?:\/|$)/.test(path) || ["/manager-search", "/post-vacancy", "/company-post", ...COMPANY_PUBLIC].includes(path) || /^\/management(?:\/|$)/.test(path)) return "manager";
  if (CREW_JOURNEY.includes(path) || /^\/jobs\/.+/.test(path)) return "crew";
  return null;
}

export const HELP_PROMPTS: Record<HelpAudience, string[]> = {
  crew: ["How do I apply for a job?", "Why does a job say recruiter contact pending?", "How do I set availability?", "How do I build my Sea Profile?"],
  manager: ["How do I post a vacancy?", "How do I arrange a crew interview?", "Why is Crew Search locked?", "How do I report a problem?"],
  marketplace: ["How do I upload vessel photos and PDFs?", "What specifications does a spare part need?", "How do welcome credits and free credit requests work?", "Why can I only see my own listings?"],
};
