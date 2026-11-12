// Hourly: 24h interview reminders (max 3, 24h apart) and post-interview improvement emails (max 3, 48h apart). Email only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";
import { followupEmail, type FollowupRow } from "../_shared/interviewFollowup.ts";

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const CAP = 150;

Deno.serve(async (req) => {
  const fail = authenticateCronRequest(req);
  if (fail) return fail;
  if (!RESEND_KEY) return Response.json({ ok: false, error: "no_provider_key" });
  const { data, error } = await svc.rpc("interview_followups_due", { p_limit: CAP });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  let sent = 0, skipped = 0;
  for (const r of (data || []) as FollowupRow[]) {
    let email = r.email;
    if (!email && r.crew_id) {
      const { data: u } = await svc.auth.admin.getUserById(r.crew_id);
      email = u?.user?.email || null;
    }
    // Improvement with nothing left and no English track = finished.
    if (r.kind === "improvement" && r.modules.length === 0 && !(r.prep_tracks || []).includes("english") ) {
      await svc.from("interview_invites").update({ improvement_status: "done" }).eq("id", r.invite_id);
      skipped++; continue;
    }
    if (r.kind === "improvement" && r.modules.length === 0 && r.attempt > 1) {
      await svc.from("interview_invites").update({ improvement_status: "done" }).eq("id", r.invite_id);
      skipped++; continue;
    }
    const now = new Date().toISOString();
    const patch = r.kind === "reminder"
      ? { reminder_count: r.attempt, last_reminder_at: now }
      : { improvement_reminders: r.attempt, improvement_sent_at: now };
    if (!email) { await svc.from("interview_invites").update(patch).eq("id", r.invite_id); skipped++; continue; }
    const m = followupEmail(r);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "SeaMinds <crew@seaminds.life>", reply_to: "support@seaminds.life", to: [email], subject: m.subject, html: m.html, text: m.text }),
    });
    const ok = res.ok;
    if (!ok) console.error("resend", res.status, await res.text());
    // Count the attempt either way so a bad address never loops.
    await svc.from("interview_invites").update(patch).eq("id", r.invite_id);
    await svc.from("app_events").insert({ event_type: `interview_${r.kind}_email`, severity: ok ? "info" : "warning",
      message: `Interview ${r.kind} ${ok ? "sent" : "failed"}`, metadata: { invite_id: r.invite_id, attempt: r.attempt, ok } });
    ok ? sent++ : skipped++;
  }
  return Response.json({ ok: true, sent, skipped });
});
