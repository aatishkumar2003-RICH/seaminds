// Splits one pasted text into separate adverts. Pure — no AI, no network.
// Explicit separator lines and chat-export message headers are trusted;
// contact-envelope and blank-line splits are flagged for review.

export type AdvertBlock = { text: string; uncertain: boolean; reason?: string };

const SEPARATOR = /^\s*(?:-{3,}|={3,}|_{3,}|\*{3,}|~{3,}|#{3,})\s*$/;
// Telegram / WhatsApp export headers: "[13/10/2026 10:21] Name:", "13/10/26, 10:21 - Name:", "Forwarded from X"
const MSG_HEADER = /^\s*(?:\[\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?\]|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?:\s*[AP]M)?\s+-\s|Forwarded from\b)/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;

/** Max characters accepted in one paste (UI + splitter). */
export const MAX_PASTE_CHARS = 50_000;
/** Max characters sent to the AI for one advert. */
export const MAX_ADVERT_CHARS = 12_000;

const contacts = (t: string) => {
  const emails = new Set((t.match(EMAIL) || []).map((e) => e.toLowerCase()));
  const phones = new Set((t.match(PHONE) || []).map((p) => p.replace(/\D/g, "")).filter((p) => p.length >= 8));
  return { emails, phones };
};
const hasContact = (t: string) => { const k = contacts(t); return k.emails.size + k.phones.size > 0; };
// A paragraph that is basically just a contact line ("WA +62…", "Email: x@y.com").
const contactOnly = (t: string) => hasContact(t) && t.split("\n").every((l) => l.replace(EMAIL, "").replace(PHONE, "").replace(/\b(?:e-?mail|wa|whatsapp|tel|phone|hp|contact|cp|mobile|call|or)\b|[:/|,.\-()+]/gi, "").trim().length < 4);

const review = (text: string, uncertain: boolean, reason?: string): AdvertBlock => {
  const { emails, phones } = contacts(text);
  if (emails.size === 0 && phones.size === 0) return { text, uncertain: true, reason: "No contact found — this may be part of another advert." };
  if (emails.size > 1) return { text, uncertain: true, reason: "Several different emails — this may be two adverts joined together." };
  if (text.length > MAX_ADVERT_CHARS) return { text, uncertain: true, reason: "Very long advert — only the first part will be read. Add --- lines to split it." };
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
    // keep consecutive contact paragraphs ("Email: …" then "WA: …") in the same advert
    if (hasContact(p) && (!next || !contactOnly(next))) { groups.push(cur.join("\n\n")); cur = []; }
  });
  if (cur.length) {
    if (groups.length) groups[groups.length - 1] += "\n\n" + cur.join("\n\n");
    else groups.push(cur.join("\n\n"));
  }
  return groups;
}

function splitPlain(text: string): AdvertBlock[] {
  const groups = envelopeSplit(text);
  if (groups.length > 1) return groups.map((g) => review(g, true, "Split at a contact line — check this is one complete advert."));
  return [review(text, false)];
}

export function splitAdverts(input: string): AdvertBlock[] {
  const text = input.replace(/\r\n?/g, "\n").slice(0, MAX_PASTE_CHARS).trim();
  if (!text) return [];
  const lines = text.split("\n");
  if (lines.some((l) => SEPARATOR.test(l))) {
    return splitOn(lines, (l) => SEPARATOR.test(l), false).map((p) => review(p, false));
  }
  if (lines.filter((l) => MSG_HEADER.test(l)).length >= 2) {
    // Chat export: each message is its own advert; long messages may still hold several adverts.
    return splitOn(lines, (l) => MSG_HEADER.test(l), true).flatMap((m) => splitPlain(m));
  }
  // Triple blank lines with a contact in each piece.
  const chunks = text.split(/\n\s*\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  if (chunks.length > 1 && chunks.every(hasContact)) {
    return chunks.map((c) => review(c, true, "Split at blank lines — check this is one complete advert."));
  }
  return splitPlain(text);
}
