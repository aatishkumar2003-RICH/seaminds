/** Recruiter country of a vacancy, read from its WhatsApp dial code.
 *  Must mirror the SQL in public.vacancy_origin_counts().
 *  New countries match only on "+code" (bare digits are ambiguous). */
export type OriginCode = string;

export interface Origin { code: OriginCode; name: string; flag: string; prefixes: string[] }

export const ORIGINS: Origin[] = [
  { code: "id", name: "Indonesia", flag: "🇮🇩", prefixes: ["+62", "62", "08"] },
  { code: "in", name: "India", flag: "🇮🇳", prefixes: ["+91", "91"] },
  { code: "ua", name: "Ukraine", flag: "🇺🇦", prefixes: ["+380", "380"] },
  { code: "ru", name: "Russia", flag: "🇷🇺", prefixes: ["+7"] },
  { code: "ph", name: "Philippines", flag: "🇵🇭", prefixes: ["+63", "63"] },
  { code: "vn", name: "Vietnam", flag: "🇻🇳", prefixes: ["+84", "84"] },
  { code: "cn", name: "China", flag: "🇨🇳", prefixes: ["+86"] },
  { code: "mm", name: "Myanmar", flag: "🇲🇲", prefixes: ["+95"] },
  { code: "bd", name: "Bangladesh", flag: "🇧🇩", prefixes: ["+880"] },
  { code: "lk", name: "Sri Lanka", flag: "🇱🇰", prefixes: ["+94"] },
  { code: "pk", name: "Pakistan", flag: "🇵🇰", prefixes: ["+92"] },
  { code: "gr", name: "Greece", flag: "🇬🇷", prefixes: ["+30"] },
  { code: "cy", name: "Cyprus", flag: "🇨🇾", prefixes: ["+357"] },
  { code: "tr", name: "Turkey", flag: "🇹🇷", prefixes: ["+90"] },
  { code: "de", name: "Germany", flag: "🇩🇪", prefixes: ["+49"] },
  { code: "gb", name: "United Kingdom", flag: "🇬🇧", prefixes: ["+44"] },
  { code: "nl", name: "Netherlands", flag: "🇳🇱", prefixes: ["+31"] },
  { code: "no", name: "Norway", flag: "🇳🇴", prefixes: ["+47"] },
  { code: "dk", name: "Denmark", flag: "🇩🇰", prefixes: ["+45"] },
  { code: "fr", name: "France", flag: "🇫🇷", prefixes: ["+33"] },
  { code: "it", name: "Italy", flag: "🇮🇹", prefixes: ["+39"] },
  { code: "hr", name: "Croatia", flag: "🇭🇷", prefixes: ["+385"] },
  { code: "pl", name: "Poland", flag: "🇵🇱", prefixes: ["+48"] },
  { code: "ro", name: "Romania", flag: "🇷🇴", prefixes: ["+40"] },
  { code: "sg", name: "Singapore", flag: "🇸🇬", prefixes: ["+65"] },
  { code: "ae", name: "UAE", flag: "🇦🇪", prefixes: ["+971"] },
  { code: "us", name: "USA", flag: "🇺🇸", prefixes: ["+1"] },
];

export const originByCode = (c: string | null | undefined) =>
  ORIGINS.find((o) => o.code === (c || "").toLowerCase()) || null;

// Longest prefix first so +380 beats +38x, +971 beats +97, etc.
const RULES = ORIGINS.flatMap((o) => o.prefixes.map((p) => ({ p, code: o.code })))
  .sort((a, b) => b.p.length - a.p.length);

export const originOf = (whatsapp: string | null | undefined): OriginCode | null => {
  const n = String(whatsapp || "").replace(/[^0-9+]/g, "");
  if (!n) return null;
  if (/^7/.test(n) && n.length === 11) return "ru";
  for (const r of RULES) if (n.startsWith(r.p)) return r.code;
  return null;
};

/** PostgREST `or` filter for contact_whatsapp (pre-filter; refine with originOf). */
export const originOrFilter = (o: Origin) =>
  [...o.prefixes, ...(o.code === "ru" ? ["7"] : [])].map((p) => `contact_whatsapp.like.${p}*`).join(",");
