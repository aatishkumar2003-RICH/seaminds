/** Mutual AI-interview scheduling. All state changes go through server RPCs; these helpers are pure. */
import { supabase } from "@/integrations/supabase/client";

export type ScheduleMode = "flex" | "proposed" | "confirmed";
export interface InterviewSchedule {
  schedule_mode: ScheduleMode;
  proposed_slots: string[] | null;
  proposed_by: "crew" | "manager" | null;
  scheduled_at: string | null;
  window_ends_at: string | null;
}

/** Interview room opens 15 minutes before an agreed time and stays open 2 hours after it. */
export const JOIN_EARLY_MIN = 15;

export type SchedulePhase =
  | { kind: "flex_open"; endsAt: Date | null }
  | { kind: "flex_expired" }
  | { kind: "your_turn"; slots: Date[] }
  | { kind: "waiting_other"; slots: Date[] }
  | { kind: "upcoming"; at: Date; msToOpen: number }
  | { kind: "join_now"; at: Date }
  | { kind: "missed"; at: Date };

export function schedulePhase(s: InterviewSchedule, me: "crew" | "manager", now = new Date()): SchedulePhase {
  const t = now.getTime();
  if (s.schedule_mode === "confirmed" && s.scheduled_at) {
    const at = new Date(s.scheduled_at);
    const end = s.window_ends_at ? new Date(s.window_ends_at).getTime() : at.getTime() + 2 * 3600_000;
    const open = at.getTime() - JOIN_EARLY_MIN * 60_000;
    if (t < open) return { kind: "upcoming", at, msToOpen: open - t };
    if (t <= end) return { kind: "join_now", at };
    return { kind: "missed", at };
  }
  if (s.schedule_mode === "proposed") {
    const slots = (s.proposed_slots || []).map((x) => new Date(x)).filter((d) => d.getTime() > t);
    return s.proposed_by === me ? { kind: "waiting_other", slots } : { kind: "your_turn", slots };
  }
  if (s.window_ends_at && new Date(s.window_ends_at).getTime() < t) return { kind: "flex_expired" };
  return { kind: "flex_open", endsAt: s.window_ends_at ? new Date(s.window_ends_at) : null };
}

/** Countdown label such as "2d 4h", "3h 10m" or "12m". */
export function countdown(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${mm}m`;
  return `${mm}m`;
}

/** Local time in the viewer's zone plus a reference zone, e.g. "Tue 28 Oct, 14:00 (your time) · 07:00 UTC". */
export function formatSlot(d: Date, refZone = "UTC"): string {
  const local = d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const ref = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: refZone });
  return `${local} · ${ref} ${refZone === "UTC" ? "UTC" : refZone.split("/").pop()}`;
}

/** Converts a value from <input type="datetime-local"> (viewer's local time) to an ISO instant. */
export const localInputToIso = (v: string) => (v ? new Date(v).toISOString() : "");

export const SCHEDULE_ERRORS: Record<string, string> = {
  not_allowed: "You can't change this interview.",
  already_completed: "This interview is already completed.",
  slot_unavailable: "That time is no longer available — refresh and pick another.",
  bad_slots: "Pick 1 to 3 times at least 30 minutes from now.",
  bad_window: "The window must be between 12 hours and 7 days.",
};

const call = async (fn: string, args: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn as any, args as any);
  if (error) return { ok: false, error: "network" } as { ok: boolean; error?: string };
  return data as { ok: boolean; error?: string };
};

export const proposeSlots = (inviteId: string, slots: string[], note?: string) =>
  call("manager_schedule_interview", { p_invite_id: inviteId, p_slots: slots, p_flex_hours: null, p_note: note || null });
export const openFlexWindow = (inviteId: string, hours: number, note?: string) =>
  call("manager_schedule_interview", { p_invite_id: inviteId, p_slots: [], p_flex_hours: hours, p_note: note || null });
export const acceptSlot = (inviteId: string, slot: string) =>
  call("respond_interview_schedule", { p_invite_id: inviteId, p_accept: slot, p_counter: null, p_note: null });
export const counterSlots = (inviteId: string, slots: string[], note?: string) =>
  call("respond_interview_schedule", { p_invite_id: inviteId, p_accept: null, p_counter: slots, p_note: note || null });
