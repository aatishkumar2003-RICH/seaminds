/** Recruiter country of a vacancy, detected in 3 tiers:
 *   1. WhatsApp dial code  2. email country domain (.ph, .com.ph…)  3. agency name / city keyword.
 *  Must mirror public.vacancy_origin_of() in SQL.
 *  New countries match phones only on "+code" (bare digits are ambiguous). */
export type OriginCode = string;

export interface Origin {
  code: OriginCode; name: string; flag: string;
  prefixes: string[];
  /** Email domain endings, e.g. ".ph" matches x@a.com.ph */
  domains: string[];
  /** Lowercase substrings of the recruiter/agency name */
  keywords: string[];
}

export const ORIGINS: Origin[] = [
  { code: "id", name: "Indonesia", flag: "🇮🇩", prefixes: ["+62", "62", "08"], domains: [".id"], keywords: ["indonesia", "jakarta", "surabaya", "batam", "semarang"] },
  { code: "in", name: "India", flag: "🇮🇳", prefixes: ["+91", "91"], domains: [".in"], keywords: ["india", "mumbai", "chennai", "kolkata", "kochi", "navi mumbai"] },
  { code: "ua", name: "Ukraine", flag: "🇺🇦", prefixes: ["+380", "380"], domains: [".ua"], keywords: ["ukrain", "odesa", "odessa", "kherson", "mykolaiv", "izmail"] },
  { code: "ru", name: "Russia", flag: "🇷🇺", prefixes: ["+7"], domains: [".ru"], keywords: ["russia", "novorossiysk", "vladivostok", "st. petersburg", "saint petersburg"] },
  { code: "ph", name: "Philippines", flag: "🇵🇭", prefixes: ["+63", "63"], domains: [".ph"], keywords: ["philippin", "phils", "manila", "cebu", "makati", "iloilo"] },
  { code: "vn", name: "Vietnam", flag: "🇻🇳", prefixes: ["+84", "84"], domains: [".vn"], keywords: ["vietnam", "viet nam", "hai phong", "haiphong", "hanoi", "ho chi minh", "saigon"] },
  { code: "cn", name: "China", flag: "🇨🇳", prefixes: ["+86"], domains: [".cn"], keywords: ["china", "shanghai", "dalian", "qingdao", "tianjin"] },
  { code: "mm", name: "Myanmar", flag: "🇲🇲", prefixes: ["+95"], domains: [".mm"], keywords: ["myanmar", "yangon"] },
  { code: "bd", name: "Bangladesh", flag: "🇧🇩", prefixes: ["+880"], domains: [".bd"], keywords: ["bangladesh", "chittagong", "dhaka"] },
  { code: "lk", name: "Sri Lanka", flag: "🇱🇰", prefixes: ["+94"], domains: [".lk"], keywords: ["sri lanka", "colombo"] },
  { code: "pk", name: "Pakistan", flag: "🇵🇰", prefixes: ["+92"], domains: [".pk"], keywords: ["pakistan", "karachi"] },
  { code: "gr", name: "Greece", flag: "🇬🇷", prefixes: ["+30"], domains: [".gr"], keywords: ["greece", "hellas", "hellenic", "piraeus", "athens"] },
  { code: "cy", name: "Cyprus", flag: "🇨🇾", prefixes: ["+357"], domains: [".cy"], keywords: ["cyprus", "limassol", "larnaca"] },
  { code: "tr", name: "Turkey", flag: "🇹🇷", prefixes: ["+90"], domains: [".tr"], keywords: ["turkey", "türkiye", "turkiye", "istanbul"] },
  { code: "de", name: "Germany", flag: "🇩🇪", prefixes: ["+49"], domains: [".de"], keywords: ["germany", "hamburg", "bremen", "gmbh"] },
  { code: "gb", name: "United Kingdom", flag: "🇬🇧", prefixes: ["+44"], domains: [".uk"], keywords: ["united kingdom", "london", "southampton", "aberdeen"] },
  { code: "nl", name: "Netherlands", flag: "🇳🇱", prefixes: ["+31"], domains: [".nl"], keywords: ["netherlands", "rotterdam", "holland"] },
  { code: "no", name: "Norway", flag: "🇳🇴", prefixes: ["+47"], domains: [".no"], keywords: ["norway", "bergen", "oslo"] },
  { code: "dk", name: "Denmark", flag: "🇩🇰", prefixes: ["+45"], domains: [".dk"], keywords: ["denmark", "copenhagen"] },
  { code: "fr", name: "France", flag: "🇫🇷", prefixes: ["+33"], domains: [".fr"], keywords: ["france", "marseille"] },
  { code: "it", name: "Italy", flag: "🇮🇹", prefixes: ["+39"], domains: [".it"], keywords: ["italy", "genoa", "genova", "naples"] },
  { code: "hr", name: "Croatia", flag: "🇭🇷", prefixes: ["+385"], domains: [".hr"], keywords: ["croatia", "rijeka", "split"] },
  { code: "pl", name: "Poland", flag: "🇵🇱", prefixes: ["+48"], domains: [".pl"], keywords: ["poland", "gdynia", "szczecin", "gdansk"] },
  { code: "ro", name: "Romania", flag: "🇷🇴", prefixes: ["+40"], domains: [".ro"], keywords: ["romania", "constanta"] },
  { code: "sg", name: "Singapore", flag: "🇸🇬", prefixes: ["+65"], domains: [".sg"], keywords: ["singapore"] },
  { code: "ae", name: "UAE", flag: "🇦🇪", prefixes: ["+971"], domains: [".ae"], keywords: ["dubai", "abu dhabi", "sharjah", "fujairah", "u.a.e"] },
  { code: "us", name: "USA", flag: "🇺🇸", prefixes: ["+1"], domains: [".us"], keywords: ["houston", "new orleans"] },
];

export const originByCode = (c: string | null | undefined) =>
  ORIGINS.find((o) => o.code === (c || "").toLowerCase()) || null;

// Longest prefix first so +380 beats +38x, +971 beats +97, etc.
const RULES = ORIGINS.flatMap((o) => o.prefixes.map((p) => ({ p, code: o.code })))
  .sort((a, b) => b.p.length - a.p.length);

const byPhone = (whatsapp: string | null | undefined): OriginCode | null => {
  const n = String(whatsapp || "").replace(/[^0-9+]/g, "");
  if (!n) return null;
  if (/^7/.test(n) && n.length === 11) return "ru";
  for (const r of RULES) if (n.startsWith(r.p)) return r.code;
  return null;
};

const byEmail = (email: string | null | undefined): OriginCode | null => {
  const e = String(email || "").trim().toLowerCase();
  if (!e.includes("@")) return null;
  for (const o of ORIGINS) if (o.domains.some((d) => e.endsWith(d))) return o.code;
  return null;
};

const byName = (name: string | null | undefined): OriginCode | null => {
  const s = String(name || "").toLowerCase();
  if (!s) return null;
  for (const o of ORIGINS) if (o.keywords.some((k) => s.includes(k))) return o.code;
  return null;
};

export interface OriginInput { whatsapp?: string | null; email?: string | null; name?: string | null }

/** Accepts a phone string (legacy) or { whatsapp, email, name }. */
export const originOf = (input: string | null | undefined | OriginInput): OriginCode | null => {
  if (input == null || typeof input === "string") return byPhone(input);
  return byPhone(input.whatsapp) || byEmail(input.email) || byName(input.name);
};

/** PostgREST `or` pre-filter (refine rows with originOf). nameCol = recruiter_name / company_name. */
export const originOrFilter = (o: Origin, nameCol?: string) => {
  const parts = [...o.prefixes, ...(o.code === "ru" ? ["7"] : [])].map((p) => `contact_whatsapp.like.${p}*`);
  o.domains.forEach((d) => parts.push(`contact_email.ilike.*${d}`));
  if (nameCol) o.keywords.forEach((k) => parts.push(`${nameCol}.ilike.*${k.replace(/[,()]/g, "")}*`));
  return parts.join(",");
};
