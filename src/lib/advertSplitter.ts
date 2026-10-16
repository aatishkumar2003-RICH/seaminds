// Splits one pasted text into separate adverts. Pure — no AI, no network.
// Explicit separator lines and chat-export message headers are trusted;
// Telegram/WhatsApp channel post headers, contact-envelope and blank-line splits are flagged for review.
// Oversized blocks are sliced into small chunks so the AI reads every vacancy (no output-fatigue ceiling).

export type AdvertBlock = { text: string; uncertain: boolean; reason?: string };

// "---", "====", "===== PASTE 01 =====", "### ADVERT 3 ###", "===== EUROPE-B8-001 =====":
// any short label enclosed by delimiter marks on both sides is a trusted cut line.
const SEPARATOR = /^\s*[-=_*~#]{3,}(?:[^\n]{1,80}?[-=_*~#]{3,})?\s*$/;
// Numbered labels on their own line: "BATCH 1", "BATCH 2 : OSM THOME - INDIA", "[ADVERT 3]", "Vacancy #4 -", "JOB 5."
// Trusted like "---" when the paste contains at least two of them. The heading line stays with its advert.
const NUMBERED_HEADER = /^\s*[[(#*]*\s*(?:batch|advert|advertisement|ad|job|vacancy|post|paste)\s*(?:no\.?|#)?\s*\d{1,4}\s*[\])*]*\s*(?:[:.\-–—|)].*)?$/i;
const isNumberedHeader = (l: string) => l.length <= 160 && NUMBERED_HEADER.test(l);
// Telegram / WhatsApp export headers: "[13/10/2026 10:21] Name:", "13/10/26, 10:21 - Name:", "Forwarded from X"
const MSG_HEADER = /^\s*(?:\[\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?\]|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?:\s*[AP]M)?\s+-\s|Forwarded from\b)/i;
// Channel post openers copied without timestamps: hiring headings, vacancy hashtags, "COMPANY:" lines,
// or a line that starts with a typical post emoji.
const POST_HEADER = /^\s*(?:(?:[\p{Extended_Pictographic}\u2693\u26F4\uFE0F\s]{1,6})?(?:urgent(?:ly)?\s+(?:required|requirement|hiring|vacanc)|we\s+are\s+hiring|now\s+hiring|job\s+(?:opening|vacanc)|vacancy\s+(?:alert|announcement)|urgent\s+vacanc|lowongan|dibutuhkan|company\s*:|agency\s*:|principal\s*:)|#(?:vacancy|vacancies|hiring|job|jobs|urgent|lowongan|loker)\b|[\p{Extended_Pictographic}\u2693\u26F4](?:\uFE0F)?\s*\S)/iu;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
// Telegram contacts: @handle (not part of an email) and t.me / wa.me links.
const HANDLE = /(?:^|[\s(:])@([A-Za-z][A-Za-z0-9_]{4,31})\b|(?:t\.me|telegram\.me|wa\.me)\/[A-Za-z0-9_+]+/gi;

/** Max characters accepted in one paste (UI + splitter). */
export const MAX_PASTE_CHARS = 200_000;
/** Max characters sent to the AI for one advert. */
export const MAX_ADVERT_CHARS = 12_000;
/** Blocks longer than this are sliced so the AI returns every vacancy. */
export const CHUNK_CHARS = 3_500;

const contacts = (t: string) => {
  const emails = new Set((t.match(EMAIL) || []).map((e) => e.toLowerCase()));
  const phones = new Set((t.match(PHONE) || []).map((p) => p.replace(/\D/g, "")).filter((p) => p.length >= 8));
  const handles = new Set((t.match(HANDLE) || []).map((h) => h.trim().replace(/^[(:]/, "").toLowerCase()));
  return { emails, phones, handles };
};
const hasContact = (t: string) => { const k = contacts(t); return k.emails.size + k.phones.size + k.handles.size > 0; };
// A paragraph that is basically just a contact line ("WA +62…", "Email: x@y.com").
const contactOnly = (t: string) => hasContact(t) && t.split("\n").every((l) => l.replace(EMAIL, "").replace(PHONE, "").replace(HANDLE, "").replace(/\b(?:e-?mail|wa|whatsapp|telegram|tg|tel|phone|hp|contact|cp|mobile|call|or|dm)\b|[:/|,.\-()+]/gi, "").trim().length < 4);

const review = (text: string, uncertain: boolean, reason?: string): AdvertBlock => {
  const { emails, phones, handles } = contacts(text);
  if (emails.size + phones.size + handles.size === 0) return { text, uncertain: true, reason: "No contact found — this may be part of another advert." };
  if (emails.size > 1) return { text, uncertain: true, reason: "Several different emails — this may be two adverts joined together." };
  return { text, uncertain, reason: uncertain ? reason : undefined };
};

const splitOn = (lines: string[], test: (l: string) => boolean, keepLine: boolean) => {
  const parts: string[] = [];
  let cur: string[] = [];
  for (const l of lines) {
    if (test(l)) { parts.push(cur.join("\n")); cur = keepLine ? [l] : []; } else cur.push(l);
  }
  parts.push(cur.join("\n"));
  return parts.map((p) => p.trim()).filter(Boolean);
};

/** Contact envelope: an advert ends at the paragraph carrying its contact. */
function envelopeSplit(text: string): string[] {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const groups: string[] = [];
  let cur: string[] = [];
  paras.forEach((p, i) => {
    cur.push(p);
    const next = paras[i + 1];
    if (hasContact(p) && (!next || !contactOnly(next))) { groups.push(cur.join("\n\n")); cur = []; }
  });
  if (cur.length) {
    if (groups.length) groups[groups.length - 1] += "\n\n" + cur.join("\n\n");
    else groups.push(cur.join("\n\n"));
  }
  return groups;
}

/** Channel posts copied without timestamps: split before each post heading (needs ≥2 headings). */
function postSplit(text: string): string[] | null {
  const lines = text.split("\n");
  // A heading only counts at the start of a paragraph (first line or after a blank line).
  const isHead = (i: number) => POST_HEADER.test(lines[i]) && (i === 0 || !lines[i - 1].trim());
  const heads = lines.map((_, i) => isHead(i)).filter(Boolean).length;
  if (heads < 2) return null;
  const parts: string[] = [];
  let cur: string[] = [];
  lines.forEach((l, i) => { if (isHead(i) && cur.join("").trim()) { parts.push(cur.join("\n")); cur = []; } cur.push(l); });
  parts.push(cur.join("\n"));
  const out = parts.map((p) => p.trim()).filter(Boolean);
  // Merge heading-only fragments with no contact into the next post.
  const merged: string[] = [];
  for (const p of out) {
    if (merged.length && !hasContact(merged[merged.length - 1]) && merged[merged.length - 1].length < 200) merged[merged.length - 1] += "\n\n" + p;
    else merged.push(p);
  }
  return merged.length > 1 ? merged : null;
}

const contactLines = (t: string) => t.split("\n").filter((l) => hasContact(l) || /^\s*(?:company|agency|principal)\s*:/i.test(l)).slice(0, 6).join("\n");

/** Slice an oversized advert at paragraph boundaries; each slice carries the advert's contact lines. */
function chunk(block: AdvertBlock): AdvertBlock[] {
  if (block.text.length <= CHUNK_CHARS) return [block];
  const paras = block.text.split(/\n\s*\n|\n(?=\s*(?:\d+[.)]|[-•*▪►✅✔]\s))/).map((p) => p.trim()).filter(Boolean);
  const slices: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length > CHUNK_CHARS) { slices.push(cur); cur = ""; }
    if (p.length > CHUNK_CHARS) { for (let i = 0; i < p.length; i += CHUNK_CHARS) slices.push(p.slice(i, i + CHUNK_CHARS)); continue; }
    cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) slices.push(cur);
  if (slices.length < 2) return [block];
  const shared = contactLines(block.text);
  const multi = contacts(block.text).emails.size > 1;
  return slices.map((s, i) => {
    const text = hasContact(s) || !shared ? s : `${s}\n\n[Contact from same advert]\n${shared}`;
    return {
      text,
      uncertain: true,
      reason: multi
        ? "Long section with several contacts — check each vacancy has the right contact."
        : `Part ${i + 1} of ${slices.length} of a long advert — check the contact is right.`,
    };
  });
}

function splitPlain(text: string): AdvertBlock[] {
  const posts = postSplit(text);
  if (posts) return posts.flatMap((p) => {
    const g = envelopeSplit(p);
    return g.length > 1 ? g.map((x) => review(x, true, "Split at a contact line — check this is one complete advert.")) : [review(p, true, "Split at a post heading — check this is one complete advert.")];
  });
  const groups = envelopeSplit(text);
  if (groups.length > 1) return groups.map((g) => review(g, true, "Split at a contact line — check this is one complete advert."));
  return [review(text, false)];
}

function splitRaw(text: string): AdvertBlock[] {
  const lines = text.split("\n");
  if (lines.some((l) => SEPARATOR.test(l))) {
    const parts = splitOn(lines, (l) => SEPARATOR.test(l), false);
    // A contactless title/intro before the first cut line joins the first advert instead of becoming its own card.
    const first = lines.findIndex((l) => SEPARATOR.test(l));
    if (parts.length > 1 && lines.slice(0, first).join("").trim() && !hasContact(parts[0])) parts.splice(0, 2, `${parts[0]}\n\n${parts[1]}`);
    return parts.map((p) => review(p, false));
  }
  if (lines.filter(isNumberedHeader).length >= 2) {
    const parts = splitOn(lines, isNumberedHeader, true);
    // Text before the first label (a shared intro) joins the first advert.
    if (parts.length > 1 && !isNumberedHeader(parts[0].split("\n")[0])) parts.splice(0, 2, `${parts[0]}\n\n${parts[1]}`);
    return parts.map((p) => review(p, false));
  }
  if (lines.filter((l) => MSG_HEADER.test(l)).length >= 2) {
    return splitOn(lines, (l) => MSG_HEADER.test(l), true).flatMap((m) => splitPlain(m));
  }
  const chunks = text.split(/\n\s*\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  if (chunks.length > 1 && chunks.every(hasContact)) {
    return chunks.map((c) => review(c, true, "Split at blank lines — check this is one complete advert."));
  }
  return splitPlain(text);
}

export function splitAdverts(input: string): AdvertBlock[] {
  const text = input.replace(/\r\n?/g, "\n").slice(0, MAX_PASTE_CHARS).trim();
  if (!text) return [];
  return splitRaw(text).flatMap(chunk);
}
