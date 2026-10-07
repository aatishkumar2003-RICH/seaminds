// R5: health-gated recovery notices. The DB (recovery_claim_due) decides WHO is recoverable;
// this function only delivers the email via the existing Resend sender and records the outcome.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { authGate } from "../_shared/aiGuard.ts";
import { sendProviderEmail } from "../_shared/finalAi.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-secret" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SITE = "https://seaminds.life";
const esc = (s: string) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const COPY: Record<string, { subject: string; title: string; body: string; bullets: string[]; cta: string }> = {
  PRE_PAPER: { subject: "Your SeaMinds assessment can now start", title: "Your assessment can now start",
    body: "Earlier, a question paper for your rank was not available. A complete paper for your rank is now available.",
    bullets: ["You are not penalised for the earlier attempt to start.", "You can start whenever you are ready."], cta: "Start my assessment" },
  IN_PAPER: { subject: "Your SeaMinds assessment is ready to resume", title: "Your assessment is ready to resume",
    body: "Your earlier session was interrupted by a technical issue. Our checks show the paper and answer saving are working for your assessment.",
    bullets: ["Your attempt and saved answers are preserved.", "You are not penalised for the interruption.", "You will continue the same paper where you left off."], cta: "Resume my assessment" },
  SCORING: { subject: "Your SeaMinds assessment result is being finalised", title: "Your result is being finalised",
    body: "All your answers are saved. Our checks show scoring is working again for your assessment.",
    bullets: ["You do not need to retake anything.", "Open SeaMinds to see your result."], cta: "View my assessment" },
};
function emailHtml(phase: string, name: string, link: string, support: string | null) {
  const c = COPY[phase] || COPY.IN_PAPER;
  return `<div style="font-family:Arial,sans-serif;background:#ffffff;padding:24px;color:#0D1B2A;max-width:520px">
  <p style="color:#D4AF37;font-weight:bold;letter-spacing:1px">SEAMINDS</p>
  <h2 style="margin:8px 0 12px">${c.title}</h2>
  <p>Hi ${esc(name) || "there"},</p>
  <p>${c.body}</p>
  <ul>${c.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>
  <p><a href="${link}" style="display:inline-block;background:#D4AF37;color:#0D1B2A;font-weight:bold;padding:12px 22px;border-radius:12px;text-decoration:none">${c.cta}</a></p>
  <p style="font-size:12px;color:#64748b">This link works once and expires soon. You will be asked to sign in to your own SeaMinds account. If it has expired, open SeaMinds and check your notifications.</p>
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

  // 1) Health-gated claim creates durable outbox rows (one per reminder). 2) Lease + send; crashes are retried after lease expiry
  // with the SAME link and idempotency key. Provider-accepted is not "delivered" (no delivery callback configured).
  const { error } = await admin.rpc("recovery_claim_due", { p_assessment_id: assessmentId, p_limit: 20 });
  if (error) return json({ error: "claim_failed" }, 500);
  let caseFilter: string | null = null;
  if (assessmentId) {
    const { data: rc } = await admin.from("recovery_cases").select("id").eq("assessment_id", assessmentId).eq("is_test", true).order("created_at", { ascending: false }).limit(1);
    caseFilter = (rc as any)?.[0]?.id || null;
    if (!caseFilter) return json({ processed: 0, results: [] });
  }
  const { data: leased, error: leaseErr } = await admin.rpc("recovery_outbox_lease", { p_case: caseFilter, p_limit: 10 });
  if (leaseErr) return json({ error: "lease_failed" }, 500);

  const results: any[] = [];
  let supportMissing = false; let persistFailures = 0;
  for (const m of (leased as any[]) || []) {
    const d = m.payload || {};
    if (!d.support_email) supportMissing = true;
    let out: { ok: true; id: string } | { ok: false; error: string };
    if (!RESEND_KEY) out = { ok: false, error: "email_provider_not_configured" };
    else if (!d.email) out = { ok: false, error: "no_email_on_account" };
    else if (!m.link_token) out = { ok: false, error: "link_unavailable" };
    else {
      const c = COPY[m.phase] || COPY.IN_PAPER;
      out = await sendProviderEmail({ fetchImpl: fetch, apiKey: RESEND_KEY, idempotencyKey: m.message_key, timeoutMs: 15000, body: {
        from: "SeaMinds <crew@seaminds.life>", to: [d.email], ...(d.support_email ? { reply_to: d.support_email } : {}),
        subject: d.is_test ? `[TEST] ${c.subject}` : c.subject,
        html: emailHtml(m.phase, d.first_name, `${SITE}/recover/${m.link_token}`, d.support_email),
      } });
    }
    const { data: rr, error: rerr } = await admin.rpc("recovery_outbox_result", {
      p_id: m.id, p_attempt: m.attempts, p_ok: out.ok, p_provider_id: out.ok ? out.id : null, p_error: out.ok ? null : out.error });
    const persisted = !rerr && (rr as any)?.ok === true;
    if (!persisted) persistFailures++;
    results.push({ outbox_id: m.id, provider_accepted: out.ok, persisted, error: out.ok ? null : out.error });
  }
  if (supportMissing) {
    await admin.from("app_events").insert({ event_type: "recovery_support_contact_missing", severity: "warning",
      message: "Recovery emails sent without a support contact: set support_contact_email and support_contact_verified=true in admin settings." });
  }
  // A DB write failure is never reported as success; the lease expires and the same message is retried idempotently.
  return json({ processed: results.length, results, delivery_tracking: "NOT_CONFIGURED" }, persistFailures ? 500 : 200);
});
