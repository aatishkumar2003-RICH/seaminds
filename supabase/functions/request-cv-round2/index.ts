import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SITE = "https://seaminds.life";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (v: unknown) => String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

async function log(inviteId: string, ok: boolean, extra: Record<string, unknown> = {}) {
  try {
    await svc.from("app_events").insert({
      event_type: "cv_round2_request_email", severity: ok ? "info" : "warning",
      message: ok ? "Round 2 CV request emailed" : "Round 2 CV request email failed",
      metadata: { invite_id: inviteId, ok, ...extra },
    });
  } catch (_) { /* observability only */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ ok: false, error: "Please sign in again." }, 401);
    const { data: u } = await svc.auth.getUser(jwt);
    const uid = u?.user?.id;
    if (!uid) return json({ ok: false, error: "Please sign in again." }, 401);

    const body = await req.json().catch(() => ({}));
    const inviteId = String(body?.invite_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(inviteId)) return json({ ok: false, error: "Missing candidate." }, 400);

    const { data: inv } = await svc.from("interview_invites")
      .select("id, token, campaign_id, status, crew_profile_id, invited_email, invited_name, cv_request_status")
      .eq("id", inviteId).maybeSingle();
    if (!inv) return json({ ok: false, error: "Candidate not found." }, 404);
    const { data: camp } = await svc.from("interview_campaigns")
      .select("manager_id, company_name, rank_required").eq("id", inv.campaign_id).maybeSingle();
    if (!camp || camp.manager_id !== uid) return json({ ok: false, error: "You do not own this interview." }, 403);
    if (inv.status !== "completed") return json({ ok: false, error: "The candidate must finish Round 1 first." }, 400);
    if (inv.cv_request_status !== "NONE") return json({ ok: true, skipped: "already_requested" });

    // Recipient resolved server-side; the manager never receives the crew email address.
    let email = (inv.invited_email || "").trim().toLowerCase();
    if (!email && inv.crew_profile_id) {
      const { data: au } = await svc.auth.admin.getUserById(inv.crew_profile_id);
      email = (au?.user?.email || "").toLowerCase();
    }
    if (!email) return json({ ok: false, error: "No email on file for this candidate." });
    if (!RESEND_KEY) { await log(inviteId, false, { skipped: "no_provider_key" }); return json({ ok: false, error: "Email service is not configured." }); }

    const examLink = `${SITE}/interview/${encodeURIComponent(inv.token)}/exam?round=2`;
    const cvLink = `${SITE}/app?tab=cv`;
    const html = `<div style="background:#0D1B2A;border-radius:14px;padding:24px;color:#fff;font-family:Arial,Helvetica,sans-serif;line-height:1.6">
  <h2 style="color:#D4AF37;font-size:18px;margin:0 0 12px">${esc(camp.company_name)} invites you to Round 2</h2>
  ${inv.invited_name ? `<p>Dear ${esc(inv.invited_name)},</p>` : ""}
  <p>Thank you for completing your Round 1 interview for <strong>${esc(camp.rank_required)}</strong>. The company has requested your Round 2 interview, scored as a <strong>CV-Based Score — CV evidence included, not independently verified</strong>.</p>
  <p>1. If you have not yet added your CV and certificates, add them first.<br/>2. Then open your Round 2 interview. Your Round 1 result stays unchanged.</p>
  <p><a href="${examLink}" style="background:#D4AF37;color:#0D1B2A;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Start Round 2 interview</a></p>
  <p><a href="${cvLink}" style="color:#D4AF37;font-weight:bold">Add or update my CV</a></p>
  <p style="color:#94A3B8;font-size:13px">No payment is ever requested. Questions: support@seaminds.life</p>
</div>`;

    let ok = false, error: string | null = null, providerId: string | null = null;
    try {
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 10000);
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", signal: ac.signal,
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "SeaMinds <crew@seaminds.life>", to: [email], reply_to: "support@seaminds.life",
          subject: `Round 2 interview request — ${camp.rank_required}`, html }),
      }).finally(() => clearTimeout(t));
      const rb: any = await r.json().catch(() => ({}));
      providerId = rb?.id ?? null;
      ok = r.ok && !!providerId;
      if (!ok) error = `[${r.status}] ${String(rb?.message || rb?.error || "no message id").slice(0, 200)}`;
    } catch (e) { error = e instanceof Error ? e.message.slice(0, 200) : "network_error"; }

    if (ok) {
      const { data: upd, error: upErr } = await svc.from("interview_invites").update({ cv_request_status: "REQUESTED" })
        .eq("id", inviteId).eq("cv_request_status", "NONE").select("id");
      if (upErr || !upd || upd.length !== 1) { ok = false; error = "The email was sent but the request could not be saved. Please try again."; }
    }
    await log(inviteId, ok, { provider_id: providerId, error });
    return json(ok ? { ok: true } : { ok: false, error: error || "The request email could not be sent." });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Unexpected error" });
  }
});
