/** Recruiter country of a vacancy, read from its WhatsApp dial code.
 *  Must mirror the SQL in public.vacancy_origin_counts(). */
export type OriginCode = "id" | "in" | "ua" | "ru" | "ph" | "vn";

export interface Origin { code: OriginCode; name: string; flag: string; prefixes: string[] }

export const ORIGINS: Origin[] = [
  { code: "id", name: "Indonesia", flag: "🇮🇩", prefixes: ["+62", "62", "08"] },
  { code: "in", name: "India", flag: "🇮🇳", prefixes: ["+91", "91"] },
  { code: "ua", name: "Ukraine", flag: "🇺🇦", prefixes: ["+380", "380"] },
  { code: "ru", name: "Russia", flag: "🇷🇺", prefixes: ["+7"] },
  { code: "ph", name: "Philippines", flag: "🇵🇭", prefixes: ["+63", "63"] },
  { code: "vn", name: "Vietnam", flag: "🇻🇳", prefixes: ["+84", "84"] },
];

export const originByCode = (c: string | null | undefined) =>
  ORIGINS.find((o) => o.code === (c || "").toLowerCase()) || null;

export const originOf = (whatsapp: string | null | undefined): OriginCode | null => {
  const n = String(whatsapp || "").replace(/[^0-9+]/g, "");
  if (!n) return null;
  if (/^(\+62|62|08)/.test(n)) return "id";
  if (/^(\+91|91)/.test(n)) return "in";
  if (/^(\+380|380)/.test(n)) return "ua";
  if (/^\+7/.test(n) || (/^7/.test(n) && n.length === 11)) return "ru";
  if (/^(\+63|63)/.test(n)) return "ph";
  if (/^(\+84|84)/.test(n)) return "vn";
  return null;
};

/** PostgREST `or` filter for contact_whatsapp (pre-filter; refine with originOf). */
export const originOrFilter = (o: Origin) =>
  [...o.prefixes, ...(o.code === "ru" ? ["7"] : [])].map((p) => `contact_whatsapp.like.${p}*`).join(",");
