// Normalises CV dates (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD, "12 Mar 2020",
// Excel serials) into the YYYY-MM-DD format HTML date inputs require. Unknown → "".
const MONTHS: Record<string, number> = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12 };

const pad = (n: number) => String(n).padStart(2, "0");
const valid = (y: number, m: number, d: number) => {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : "";
};

export function normalizeCvDate(input: unknown): string {
  if (input === null || input === undefined) return "";
  const s = String(input).trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let y = +m[3]; if (y < 100) y += y > 50 ? 1900 : 2000;
    let d = +m[1], mo = +m[2];
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    return valid(y, mo, d);
  }
  m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s,-]+(\d{4})$/);
  if (m && MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m?.[2]?.slice(0, 3).toLowerCase() ?? ""]) {
    const mo = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
    return valid(+m[3], mo, +m[1]);
  }
  if (/^\d{5}$/.test(s)) {
    const n = +s;
    if (n > 20000 && n < 60000) {
      const dt = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
      return valid(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }
  }
  return "";
}
