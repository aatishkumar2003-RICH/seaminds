/** Adaptive crew training client. Selection, grading and dwell checks are server-side (training_* RPCs). */
import { supabase } from "@/integrations/supabase/client";

export const TRADING_AREAS = [
  { code: "", label: "Any / not known" },
  { code: "AMSA", label: "Australia (AMSA)" },
  { code: "USCG", label: "United States (USCG)" },
  { code: "PARIS_MOU", label: "Europe (Paris MOU)" },
  { code: "TOKYO_MOU", label: "Asia-Pacific (Tokyo MOU)" },
] as const;

export type Recommendation = { slug: string; title: string; summary: string; score: number; reasons: string[]; gap: boolean; assigned: boolean };
export type LedgerItem = {
  title: string; slug: string; status: "assigned" | "opened" | "completed"; reasons: string[];
  assigned_at: string; opened_at: string | null; completed_at: string | null; dwell_seconds: number | null;
  quiz_correct: number | null; quiz_total: number | null; concepts: string[]; token: string | null;
};

const rpc = async (fn: string, args: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn as any, args as any);
  if (error) return { ok: false, error_code: "NETWORK" } as any;
  return (data ?? { ok: false, error_code: "NETWORK" }) as any;
};

export const recommendTraining = (inviteId: string | null, area: string, limit = 4) =>
  rpc("training_recommend", { p_invite_id: inviteId, p_area: area || null, p_limit: limit });
export const assignTraining = (inviteId: string | null, slugs: string[] | null, area: string) =>
  rpc("training_assign", { p_invite_id: inviteId, p_slugs: slugs, p_area: area || null });
export const trainingLedger = (inviteId: string | null) => rpc("training_ledger", { p_invite_id: inviteId });
export type TrainingSummary = { invite_id: string; assigned: number; completed: number };
export const campaignTrainingSummary = (campaignId: string) => rpc("campaign_training_summary", { p_campaign_id: campaignId });
export const trainingProgress = (items: Pick<LedgerItem, "status">[]) => ({
  assigned: items.length,
  completed: items.filter((item) => item.status === "completed").length,
});
export const trainingStatus = (summary: Pick<TrainingSummary, "assigned" | "completed">) =>
  summary.assigned === 0 ? "none" : summary.completed === summary.assigned ? "complete" : "pending";
export const trainingWhatsAppLink = (phone: string, message: string) =>
  `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`;
export const openTraining = (token: string) => rpc("training_open", { p_token: token });
export const completeTraining = (token: string, answers: number[]) => rpc("training_complete", { p_token: token, p_answers: answers });

export const trainingLink = (token: string, origin = "https://seaminds.life") => `${origin}/training/${encodeURIComponent(token)}`;

/** WhatsApp text for a manager sending assigned modules to a candidate. */
export const trainingMessage = (name: string, company: string, items: { title: string; token: string }[], origin?: string) =>
  [`Hello ${name || "there"},`, `${company || "Our team"} has prepared short training for you on SeaMinds (about 3–5 minutes each):`, "",
    ...items.map((i, n) => `${n + 1}. ${i.title}\n${trainingLink(i.token, origin)}`), "",
    "Read the briefing, then answer 3 quick questions to confirm. Free for crew."].join("\n");

/** Plain-text pre-joining training record for a candidate's crew file. Only completed modules count as verified. */
export const trainingDossier = (name: string, items: LedgerItem[]) => {
  const done = items.filter((i) => i.status === "completed");
  const open = items.filter((i) => i.status !== "completed");
  return [
    `PRE-JOINING TRAINING RECORD — ${name || "Candidate"}`,
    `Verified: ${done.length} of ${items.length} assigned`, "",
    ...done.map((i, n) => `${n + 1}. ${i.title}\n   Completed ${i.completed_at ? new Date(i.completed_at).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "—"} · Reading time ${i.dwell_seconds ?? 0}s · Quiz ${i.quiz_correct ?? 0}/${i.quiz_total ?? 0}`),
    ...(open.length ? ["", "Not yet completed:", ...open.map((i) => `- ${i.title} (${i.status === "opened" ? "opened" : "sent"})`)] : []),
    "", "Recorded by SeaMinds — reading time and quiz graded on the server.",
  ].join("\n");
};

export const trainingError = (code?: string, wait?: number) => ({
  AUTH_REQUIRED: "Please sign in to continue.",
  NOT_FOUND: "This training link is not valid.",
  WRONG_ACCOUNT: "This training was assigned to a different SeaMinds account. Sign in with the account the company invited.",
  FORBIDDEN: "You can only plan training for candidates of your own interviews.",
  NOT_STARTED: "The candidate has not started the interview yet, so there is no profile to plan training for.",
  TOO_FAST: `Please take time to read the briefing first — ${wait ?? 0}s left.`,
  COOLDOWN: `Review the briefing again, then retry in ${wait ?? 0}s.`,
  INCOMPLETE: "Please answer every question.",
  NOTHING_TO_ASSIGN: "No new training matches right now — everything relevant is already completed.",
  TOO_MANY: "Choose up to 5 modules at a time.",
} as Record<string, string>)[code || ""] || "Something went wrong. Check your connection and try again.";

export type MatrixTier = "VETTING" | "STATUTORY" | "OPERATIONAL";
export type Segment = "TANKER" | "DRY" | "ALL";
export type CatalogItem = { slug: string; title: string; summary: string; tier: MatrixTier; vessel_families: string[]; departments: string[]; media_url: string | null; media_label: string | null; status: LedgerItem["status"] | null; token: string | null };
export const trainingCatalog = () => rpc("training_catalog", {});
export const MATRIX_TIERS: { tier: MatrixTier; label: string; hint: string }[] = [
  { tier: "VETTING", label: "Mandatory vetting", hint: "Charterer / oil-major inspection requirements for your ship type" },
  { tier: "STATUTORY", label: "Statutory — all ships", hint: "SOLAS, MARPOL, MLC and port state control essentials" },
  { tier: "OPERATIONAL", label: "Job & department skills", hint: "Practical skills for your rank and department" },
];
const SEGMENT_FAMILIES: Record<Exclude<Segment, "ALL">, string[]> = {
  TANKER: ["OIL_TANKER", "CHEM_TANKER", "LNG", "LPG"],
  DRY: ["BULK", "GENERAL_CARGO", "CONTAINER"],
};
/** Groups catalog by tier. Modules without vessel families apply to every ship; others only to their segment. */
export const trainingMatrix = (items: CatalogItem[], segment: Segment) => {
  const fits = (i: CatalogItem) => segment === "ALL" || !i.vessel_families.length || i.vessel_families.some((f) => SEGMENT_FAMILIES[segment].includes(f));
  return MATRIX_TIERS.map((t) => ({ ...t, items: items.filter((i) => i.tier === t.tier && fits(i)) }));
};
