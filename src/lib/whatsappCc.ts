// Normalises a WhatsApp number typed with or without a country code.
// "+62 813…", "0062 813…", "62813…", "0813…" and "813…" all become "+62813…" when cc = "+62".
export function withCountryCode(raw: string, cc: string): string {
  const c = (raw || "").replace(/[\s()\-.]/g, "");
  if (!c) return raw;
  if (c.startsWith("+")) return c;
  if (c.startsWith("00")) return `+${c.slice(2)}`;
  if (!/^\d+$/.test(c) || !cc) return raw;
  const ccDigits = cc.replace(/\D/g, "");
  if (/^0\d{6,14}$/.test(c)) return `${cc}${c.slice(1)}`;
  if (c.startsWith(ccDigits) && c.length >= ccDigits.length + 8) return `+${c}`;
  if (/^\d{7,12}$/.test(c)) return `${cc}${c}`;
  return raw;
}
