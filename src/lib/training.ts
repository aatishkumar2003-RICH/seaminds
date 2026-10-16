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
export const openTraining = (token: string) => rpc("training_open", { p_token: token });
export const completeTraining = (token: string, answers: number[]) => rpc("training_complete", { p_token: token, p_answers: answers });

export const trainingLink = (token: string, origin = "https://seaminds.life") => `${origin}/training/${encodeURIComponent(token)}`;

/** WhatsApp text for a manager sending assigned modules to a candidate. */
export const trainingMessage = (name: string, company: string, items: { title: string; token: string }[], origin?: string) =>
  [`Hello ${name || "there"},`, `${company || "Our team"} has prepared short training for you on SeaMinds (about 3–5 minutes each):`, "",
    ...items.map((i, n) => `${n + 1}. ${i.title}\n${trainingLink(i.token, origin)}`), "",
    "Read the briefing, then answer 3 quick questions to confirm. Free for crew."].join("\n");

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
