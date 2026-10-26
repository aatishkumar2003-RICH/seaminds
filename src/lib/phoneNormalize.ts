// Maritime phone normalizer for WhatsApp lead ingestion. Default country = Indonesia.
const CC = ["62", "63", "91", "84", "95", "880", "94", "86", "7", "380", "48", "1", "44", "65", "60", "66"];

export function normalizePhone(raw: string, defaultCc = "62"): string | null {
  let s = String(raw || "").trim();
  const plus = s.startsWith("+") || s.startsWith("00");
  let d = s.replace(/\D/g, "");
  if (s.startsWith("00")) d = d.slice(2);
  if (!d) return null;
  if (plus) {
    // Common typo: +62 0812… → +62812…
    const cc = CC.find((c) => d.startsWith(c));
    if (cc && d[cc.length] === "0") d = cc + d.slice(cc.length + 1);
  } else if (d.startsWith("0")) {
    d = defaultCc + d.slice(1);
  } else if (d.startsWith(defaultCc) && d.length >= 10) {
    if (d[defaultCc.length] === "0") d = defaultCc + d.slice(defaultCc.length + 1);
  } else if (defaultCc === "62" && d.startsWith("8") && d.length >= 9 && d.length <= 12) {
    d = "62" + d;
  }
  if (d.length < 10 || d.length > 15) return null;
  return "+" + d;
}

export type ExtractedLead = { name: string | null; phone_raw: string; phone_e164: string | null; rank: string | null };

// Pull phone-like tokens out of free text / spreadsheet text, keeping the rest of the line as a name hint.
export function extractLeadsFromText(text: string, defaultCc = "62"): ExtractedLead[] {
  const out: ExtractedLead[] = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const matches = line.match(/(?:\+|00)?\d[\d\s().-]{7,18}\d/g) || [];
    for (const m of matches) {
      const e164 = normalizePhone(m, defaultCc);
      // Numbers only: names in chats/sheets are unreliable, so none are kept.
      out.push({ name: null, phone_raw: m.trim(), phone_e164: e164, rank: null });
    }
  }
  return out;
}
