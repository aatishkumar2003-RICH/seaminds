// Splits one pasted text into separate adverts. Pure — no AI, no network.
// Explicit separator lines are trusted; blank-line splits are flagged for review.

export type AdvertBlock = { text: string; uncertain: boolean; reason?: string };

const SEPARATOR = /^\s*(?:-{3,}|={3,}|_{3,}|\*{3,}|~{3,}|#{3,})\s*$/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;

const contacts = (t: string) => {
  const emails = new Set((t.match(EMAIL) || []).map((e) => e.toLowerCase()));
  const phones = new Set((t.match(PHONE) || []).map((p) => p.replace(/\D/g, "")).filter((p) => p.length >= 8));
  return { emails, phones };
};

const review = (text: string, uncertain: boolean, reason?: string): AdvertBlock => {
  const { emails, phones } = contacts(text);
  if (emails.size === 0 && phones.size === 0) return { text, uncertain: true, reason: "No contact found — this may be part of another advert." };
  if (emails.size > 1) return { text, uncertain: true, reason: "Several different emails — this may be two adverts joined together." };
  return { text, uncertain, reason: uncertain ? reason : undefined };
};

export const MAX_ADVERTS_PER_PASTE = 20;

export function splitAdverts(input: string): AdvertBlock[] {
  const text = input.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n");
  if (lines.some((l) => SEPARATOR.test(l))) {
    const parts: string[] = [];
    let cur: string[] = [];
    for (const l of lines) {
      if (SEPARATOR.test(l)) { parts.push(cur.join("\n")); cur = []; } else cur.push(l);
    }
    parts.push(cur.join("\n"));
    return parts.map((p) => p.trim()).filter(Boolean).map((p) => review(p, false));
  }
  // No explicit separators: split on 2+ blank lines only when each piece has its own contact.
  const chunks = text.split(/\n\s*\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  if (chunks.length > 1 && chunks.every((c) => { const k = contacts(c); return k.emails.size + k.phones.size > 0; })) {
    return chunks.map((c) => review(c, true, "Split at blank lines — check this is one complete advert."));
  }
  return [review(text, false)];
}
