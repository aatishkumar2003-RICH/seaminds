import { supabase } from "@/integrations/supabase/client";

/**
 * CV Unique ID: <COUNTRY>-<4 ALPHANUMERIC>-<GENDER>
 * e.g. ID-1A2B-M · VN-7XQ9-F · PH-Z8K4-M · IN-4M2P-F
 *
 * 36^4 = 1,679,616 combinations per country (> 1.6 million).
 */

const NATIONALITY_TO_CC: Record<string, string> = {
  indonesia: "ID", indonesian: "ID",
  india: "IN", indian: "IN",
  philippines: "PH", filipino: "PH", philippine: "PH", pilipino: "PH",
  vietnam: "VN", vietnamese: "VN",
  bangladesh: "BD", bangladeshi: "BD",
  "sri lanka": "LK", "sri lankan": "LK", srilankan: "LK",
  myanmar: "MM", burmese: "MM", burma: "MM",
  pakistan: "PK", pakistani: "PK",
  nepal: "NP", nepalese: "NP", nepali: "NP",
  china: "CN", chinese: "CN",
  ukraine: "UA", ukrainian: "UA",
  russia: "RU", russian: "RU",
  poland: "PL", polish: "PL",
  romania: "RO", romanian: "RO",
  croatia: "HR", croatian: "HR",
  greece: "GR", greek: "GR",
  turkey: "TR", turkish: "TR",
  georgia: "GE", georgian: "GE",
  latvia: "LV", latvian: "LV",
  lithuania: "LT", lithuanian: "LT",
  estonia: "EE", estonian: "EE",
  bulgaria: "BG", bulgarian: "BG",
  norway: "NO", norwegian: "NO",
  netherlands: "NL", dutch: "NL",
  "united kingdom": "GB", uk: "GB", british: "GB", england: "GB",
  "united states": "US", usa: "US", american: "US",
  brazil: "BR", brazilian: "BR",
  nigeria: "NG", nigerian: "NG",
  ghana: "GH", ghanaian: "GH",
  egypt: "EG", egyptian: "EG",
  "south africa": "ZA", "south african": "ZA",
  kenya: "KE", kenyan: "KE",
  malaysia: "MY", malaysian: "MY",
  singapore: "SG", singaporean: "SG",
  thailand: "TH", thai: "TH",
  "south korea": "KR", korean: "KR", korea: "KR",
  japan: "JP", japanese: "JP",
  italy: "IT", italian: "IT",
  spain: "ES", spanish: "ES",
  portugal: "PT", portuguese: "PT",
  france: "FR", french: "FR",
  germany: "DE", german: "DE",
  australia: "AU", australian: "AU",
  "new zealand": "NZ",
  canada: "CA", canadian: "CA",
};

export const countryCodeFromNationality = (nationality?: string): string => {
  const key = (nationality || "").trim().toLowerCase();
  if (!key) return "XX";
  if (NATIONALITY_TO_CC[key]) return NATIONALITY_TO_CC[key];
  const hit = Object.keys(NATIONALITY_TO_CC).find((k) => key.includes(k));
  if (hit) return NATIONALITY_TO_CC[hit];
  const letters = key.replace(/[^a-z]/g, "").toUpperCase();
  return (letters.slice(0, 2) || "XX").padEnd(2, "X");
};

export const genderChar = (gender?: string): "M" | "F" | "X" => {
  const g = (gender || "").trim().toLowerCase();
  if (g.startsWith("m")) return "M";
  if (g.startsWith("f")) return "F";
  return "X";
};

const ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const randomBlock = (len = 4): string => {
  const bytes = new Uint32Array(len);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 4294967295);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHANUM[bytes[i] % ALPHANUM.length];
  return out;
};

export const formatCvId = (cc: string, block: string, g: string) => `${cc}-${block}-${g}`;

export const CV_ID_PATTERN = /^[A-Z]{2}-[A-Z0-9]{4}-[MFX]$/;

/** True when the id is already taken by another crew profile. */
const isTaken = async (id: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("crew_profiles")
    .select("id")
    .eq("crew_unique_id", id)
    .limit(1);
  if (error) return false;
  return (data?.length || 0) > 0;
};

/**
 * Generates a globally unique CV ID, verifying against the database before returning.
 */
export const generateUniqueCvId = async (opts: {
  nationality?: string;
  gender?: string;
  attempts?: number;
}): Promise<string> => {
  const cc = countryCodeFromNationality(opts.nationality);
  const g = genderChar(opts.gender);
  const attempts = opts.attempts ?? 12;
  for (let i = 0; i < attempts; i++) {
    const candidate = formatCvId(cc, randomBlock(4), g);
    // eslint-disable-next-line no-await-in-loop
    if (!(await isTaken(candidate))) return candidate;
  }
  // Extremely unlikely fallback — still unique-checked by the DB index.
  return formatCvId(cc, randomBlock(4), g);
};
