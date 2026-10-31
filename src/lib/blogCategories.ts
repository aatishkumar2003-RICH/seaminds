// Blog hub sections, derived from article title/excerpt at read time (no schema field).
export type BlogCategory = "all" | "orals" | "technical" | "managers" | "english" | "brain" | "jobs";

export const BLOG_CATEGORIES: { value: BlogCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "orals", label: "🎓 Orals & Promotion" },
  { value: "technical", label: "🚢 LPG · LNG · Tanker · Bulk" },
  { value: "managers", label: "🏢 For Ship Managers" },
  { value: "english", label: "🗣️ English & PSC" },
  { value: "brain", label: "🧠 SeaMinds Brain & Features" },
  { value: "jobs", label: "💼 Jobs & Market" },
];

const RULES: [Exclude<BlogCategory, "all">, RegExp][] = [
  ["orals", /\boral|viva|promotion|mmd|dg shipping|marina|class (i|ii|iv|1|2|4)\b|coc|competency exam|interview prep|mock interview/i],
  ["technical", /\blpg|lng|gas carrier|reliquef|\bbog\b|tanker|igs|inert gas|bulk|imsbc|grain|container|reefer|ammonia|ballast|engine room|machinery|boiler|purifier|bunker/i],
  ["managers", /manager|manning agenc|fleet|sire|tmsa|vetting|recruit|crewing|for companies|superintendent/i],
  ["english", /english|smcp|psc|port state|communication|paris mou|uscg/i],
  ["brain", /seaminds|\bbrain|photo diagnos|certificate wallet|rest hours|\bai\b|sos|privacy|score/i],
  ["jobs", /job|vacanc|salary|market|hiring|berth|wage/i],
];

export function blogCategoryOf(text: string): Exclude<BlogCategory, "all"> {
  for (const [cat, re] of RULES) if (re.test(text)) return cat;
  return "jobs";
}
