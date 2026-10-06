// R5: health-gated recovery notices. The DB (recovery_claim_due) decides WHO is recoverable;
// this function only delivers the email via the existing Resend sender and records the outcome.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { authGate } from "../_shared/aiGuard.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-secret" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SITE = "https://seaminds.life";
const esc = (s: string) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function emailHtml(name: string, link: string, support: string | null) {
  return `<div style="font-family:Arial,sans-serif;background:#ffffff;padding:24px;color:#0D1B2A;max-width:520px">
  <p style="color:#D4AF37;font-weight:bold;letter-spacing:1px">SEAMINDS</p>
  <h2 style="margin:8px 0 12px">Your assessment is ready to resume</h2>
  <p>Hi ${esc(name) || "there"},</p>
  <p>Your earlier assessment session was interrupted by a technical issue. That issue has been checked and your assessment can now continue.</p>
  <ul><li>Your attempt and saved answers are preserved.</li><li>You are not penalised for the interruption.</li><li>You will continue the same paper where you left off.</li></ul>
  <p><a href="${link}" style="display:inline-block;background:#D4AF37;color:#0D1B2A;font-weight:bold;padding:12px 22px;border-radius:12px;text-decoration:none">Resume my assessment</a></p>
  <p style="font-size:12px;color:#64748b">This link works once and expires soon. You will be asked to sign in to your own SeaMinds account. If it has expired, open SeaMinds and you will find a resume message in your notifications.</p>
  ${support ? `<p style="font-size:12px;color:#64748b">Need help? Contact ${esc(support)}.</p>` : ""}
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const gate = await authGate(req, admin, cors);
  if (!gate.ok) return gate.response;

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  let assessmentId: string | null = typeof body.assessmentId === "string" ? body.assessmentId : null;

  // Non-worker callers: admin only, and only for TEST recovery cases (test hook).
  if (!gate.isWorker) {
    const { data: isAdm } = await admin.rpc("is_admin", { _user_id: gate.userId });
    if (!isAdm || !assessmentId) return json({ error: "Forbidden" }, 403);
    const { data: c } = await admin.from("recovery_cases").select("is_test").eq("assessment_id", assessmentId).eq("is_test", true).eq("crew_profile_id", gate.userId).limit(1); // R6: TEST sends only to the calling admin's own account
    if (!c?.length) return json({ error: "TEST_CASE_REQUIRED" }, 403);
  } else if (assessmentId) {
    assessmentId = null; // cron drains due cases only
  }

  const { data: due, error } = await admin.rpc("recovery_claim_due", { p_assessment_id: assessmentId, p_limit: 20 });
  if (error) return json({ error: "claim_failed" }, 500);

  const results: any[] = [];
  let supportMissing = false;
  for (const d of (due as any[]) || []) {
    if (!d.support_email) supportMissing = true;
    const link = `${SITE}/recover/${d.token}`;
    let ok = false, err: string | null = null;
    if (!RESEND_KEY) err = "email_provider_not_configured";
    else if (!d.email) err = "no_email_on_account";
    else {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `recovery-${d.case_id}-${d.reminder}` },
          body: JSON.stringify({
            from: "SeaMinds <crew@seaminds.life>", to: [d.email],
            subject: d.is_test ? "[TEST] Your SeaMinds assessment is ready to resume" : "Your SeaMinds assessment is ready to resume",
            html: emailHtml(d.first_name, link, d.support_email),
          }),
        });
        ok = r.ok; if (!ok) err = `provider_${r.status}`;
        await r.text();
      } catch (_e) { err = "provider_unreachable"; }
    }
    await admin.rpc("recovery_mark_sent", { p_case: d.case_id, p_ok: ok, p_error: err });
    results.push({ case_id: d.case_id, sent: ok, error: err });
  }
  if (supportMissing) {
    await admin.from("app_events").insert({ event_type: "recovery_support_contact_missing", severity: "warning",
      message: "Recovery emails sent without a support contact: set support_contact_email and support_contact_verified=true in admin settings." });
  }
  return json({ processed: results.length, results });
});
