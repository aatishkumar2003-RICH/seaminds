/** Bulk cadet list parsing (Excel/CSV table, Word/PDF text or pasted lines) → enrol rows. Pure; tested. */
import type { CadetTrack } from "./cadetCurriculum";
export type CadetBulkRow = { email: string; name: string; track: CadetTrack; vessel: string };
const EMAIL = /[^\s@,;<>"']+@[^\s@,;<>"']+\.[a-z]{2,}/i;
export const trackOf = (s: string): CadetTrack | null => /engine|\beng\b|e\/c|\bec\b|oiler|motorman/i.test(s) ? "engine" : /deck|\bd\/c\b|\bdc\b|navigat/i.test(s) ? "deck" : null;
const isTrackCell = (s: string) => /^(deck|engine)?\s*(cadet)?$/i.test(s.trim()) || /^(d\/c|e\/c|dc|ec)$/i.test(s.trim());

export function parseCadetTable(table: string[][], fallback: CadetTrack = "deck"): CadetBulkRow[] {
  const rows = table.map((r) => r.map((c) => String(c ?? "").trim())).filter((r) => r.some(Boolean));
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.toLowerCase());
  const hasHead = head.some((h) => /e-?mail/.test(h)) && !rows[0].some((c) => EMAIL.test(c));
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const ci = hasHead ? { e: col(/e-?mail/), n: col(/name/), t: col(/track|rank|dep|position|type/), v: col(/vessel|ship/) } : null;
  const out: CadetBulkRow[] = [];
  for (const r of hasHead ? rows.slice(1) : rows) {
    const line = r.join(" ");
    const email = (ci && ci.e >= 0 ? r[ci.e] : line).match(EMAIL)?.[0]?.toLowerCase();
    if (!email) continue;
    let name = "", vessel = "";
    if (ci) { name = ci.n >= 0 ? r[ci.n] : ""; vessel = ci.v >= 0 ? r[ci.v] : ""; }
    else {
      const rest = r.flatMap((c) => c.replace(EMAIL, " ").split(/\s*[,;|\t]\s*/)).map((s) => s.trim()).filter((s) => s && !isTrackCell(s));
      name = rest[0] || ""; vessel = rest[1] || "";
    }
    const track = trackOf(ci && ci.t >= 0 ? r[ci.t] : line) || fallback;
    out.push({ email, name: name.slice(0, 80), track, vessel: vessel.slice(0, 80) });
  }
  const seen = new Set<string>();
  return out.filter((x) => !seen.has(x.email) && seen.add(x.email));
}

/** Free text (paste, Word, PDF): one cadet per line; commas/tabs separate fields. */
export const parseCadetText = (text: string, fallback: CadetTrack = "deck") =>
  parseCadetTable(text.split(/\r?\n/).map((l) => l.split(/\t|,|;|\|/)), fallback);

export const cadetInviteText = (name: string, company: string, track: CadetTrack, email: string) =>
  `Hello ${name || "Cadet"},\n${company || "Our company"} has enrolled you in the SeaMinds Cadet Academy (${track === "deck" ? "Deck" : "Engine"} Cadet): 4 weeks shore induction + 28 weeks onboard, one short module, practical checklist and test each week.\n\n1. Sign in or create your free account with this email: ${email}\n2. Open your Cadet Passport: https://seaminds.life/training?tab=cadet\n\nYou will get a daily reminder until each week is done.`;
