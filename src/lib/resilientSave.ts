import { supabase } from "@/integrations/supabase/client";

type Result = { error: any; data?: any };

/** Postgres/PostgREST errors that a retry can never fix (bad data, permissions). */
const isPermanent = (e: any) => {
  const code = String(e?.code || "");
  return /^(22|23|42)/.test(code) || code === "P0001";
};

/**
 * Runs a save; on a transient failure (expired session, dropped connection)
 * refreshes the sign-in and retries up to twice. Final failures are recorded
 * in app_events so the team sees the real reason instead of a vague toast.
 */
export async function resilientSave(label: string, run: () => PromiseLike<Result>): Promise<Result> {
  let last: Result = { error: null };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      last = await run();
    } catch (e) {
      last = { error: e };
    }
    if (!last.error || isPermanent(last.error)) break;
    await supabase.auth.refreshSession().catch(() => undefined);
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
  }
  if (last.error) void logSaveFailure(label, last.error);
  return last;
}

async function logSaveFailure(label: string, error: any) {
  try {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return;
    await supabase.from("app_events").insert({
      event_type: "save_failed",
      severity: "warning",
      user_id: uid,
      message: `Save failed: ${label}`,
      metadata: {
        code: error?.code ?? null,
        message: String(error?.message || error).slice(0, 300),
        online: typeof navigator !== "undefined" ? navigator.onLine : null,
      },
    } as any);
  } catch { /* never let logging break the UI */ }
}

/** Plain-language message for crew, based on why the save failed. */
export function saveErrorMessage(error: any): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "You appear to be offline. Your answers are kept — tap Finish again once connected.";
  if (isPermanent(error)) return "Some details could not be accepted. Please check your answers and try again.";
  return "Saving took too long. Your answers are kept — please tap Finish again.";
}
