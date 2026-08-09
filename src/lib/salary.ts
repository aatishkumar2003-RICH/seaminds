// Null-safe salary formatting. Never renders "null" / "undefined".

const num = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return null;
  const n = Number(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;

/** Format a min/max salary range. Returns null when nothing usable. */
export const formatSalaryRange = (
  min: any,
  max: any,
  suffix = "/month",
): string | null => {
  const lo = num(min);
  const hi = num(max);
  if (lo && hi) return lo === hi ? `${fmt(lo)}${suffix}` : `${fmt(lo)}–${fmt(hi)}${suffix}`;
  if (lo) return `${fmt(lo)}+${suffix}`;
  if (hi) return `up to ${fmt(hi)}${suffix}`;
  return null;
};

/**
 * Clean a salary value that may already be a pre-built string
 * (e.g. "12300-null", "$12,300 - $15,000", "Negotiable").
 */
export const formatSalaryText = (value: any, suffix = "/month"): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return formatSalaryRange(value, null, suffix);

  let s = String(value).trim();
  if (!s) return null;
  const low = s.toLowerCase();
  if (low === "null" || low === "undefined") return null;

  // Strip trailing/leading null or undefined parts of a range
  s = s.replace(/[-–—\s]*(null|undefined)\s*$/i, "").replace(/^\s*(null|undefined)[-–—\s]*/i, "").trim();
  if (!s || /null|undefined/i.test(s)) {
    s = s.replace(/null|undefined/gi, "").trim();
  }
  if (!s) return null;

  const nums = s.match(/\d[\d,.]*/g);
  if (!nums || nums.length === 0) {
    // Non-numeric text like "Negotiable" — keep as-is
    return s;
  }
  if (nums.length === 1) {
    const hadRange = /[-–—]|to\b/i.test(s);
    const one = num(nums[0]);
    if (!one) return null;
    return hadRange ? `${fmt(one)}+${suffix}` : `${fmt(one)}${suffix}`;
  }
  return formatSalaryRange(nums[0], nums[1], suffix);
};
