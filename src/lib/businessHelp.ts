export type HelpAudience = "manager" | "marketplace" | "crew";

export function businessHelpAudience(path: string): HelpAudience | null {
  if (/^\/marketplace(?:\/|$)/.test(path)) return "marketplace";
  if (/^\/manager(?:\/|$)/.test(path) || ["/manager-search", "/post-vacancy", "/company-post"].includes(path) || /^\/management(?:\/|$)/.test(path)) return "manager";
  return null;
}

export const HELP_PROMPTS: Record<HelpAudience, string[]> = {
  crew: ["My exam was interrupted", "What do I need for CV-based scoring?", "How do I set availability?", "Paper not ready"],
  manager: ["How do I post a vacancy?", "How do I arrange a crew interview?", "Why is Crew Search locked?", "How do I report a problem?"],
  marketplace: ["How do I upload vessel photos and PDFs?", "What specifications does a spare part need?", "How do welcome credits and free credit requests work?", "Why can I only see my own listings?"],
};