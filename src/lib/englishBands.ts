export type EnglishBand = "attention" | "fluent" | "operational" | "developing" | "under" | "none";
export const englishBand = (s: number | null | undefined): Exclude<EnglishBand, "attention"> =>
  s == null ? "none" : s >= 85 ? "fluent" : s >= 70 ? "operational" : s >= 50 ? "developing" : "under";
export const ENGLISH_BANDS: { key: EnglishBand; label: string; hint: string; color: string }[] = [
  { key: "attention", label: "⚠️ Needs attention", hint: "below 70%", color: "#f59e0b" },
  { key: "under", label: "🔴 Under the mark", hint: "below 50%", color: "#ef4444" },
  { key: "developing", label: "🟡 Developing", hint: "50–69%", color: "#f59e0b" },
  { key: "operational", label: "🟢 Operational", hint: "70–84%", color: "#22c55e" },
  { key: "fluent", label: "🌟 Fluent", hint: "85% +", color: "#D4AF37" },
  { key: "none", label: "⏳ Not assessed", hint: "no drills yet", color: "#94A3B8" },
];
