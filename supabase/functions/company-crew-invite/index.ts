// Emails roster claim links for a manager's own company crew records (Resend batch, max 300 per call).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SITE = "https://seaminds.life";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const esc = (v: unknown) => String(v ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ ok: false, error: "Please sign in again." }, 401);
    const { data: u } = await svc.auth.getUser(jwt);
    const uid = u?.user?.id;
    if (!uid) return json({ ok: false, error: "Please sign in again." }, 401);
    const { data: mp } = await svc.from("manager_profiles").select("company_name, admin_approved").eq("user_id", uid).maybeSingle();
    if (!mp) return json({ ok: false, error: "Only company accounts can send crew invitations." }, 403);
    if (!mp.admin_approved) return json({ ok: false, error: "Your company account is waiting for SeaMinds approval." }, 403);
    if (!RESEND_KEY) return json({ ok: false, error: "Email sending is not configured." }, 500);

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string" && UUID.test(x)).slice(0, 300) : [];
    if (!ids.length) return json({ ok: false, error: "Choose crew to invite." }, 400);

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: rows, error } = await svc.from("company_crew_records")
      .select("id, first_name, last_name, rank, email, crew_unique_id, claim_token, status, invited_at, invite_channel")
      .eq("manager_id", uid).in("id", ids);
    if (error) throw error;
    const eligible = (rows || []).filter((r) => r.email && ["pending", "invited"].includes(r.status)
      && !(r.invite_channel === "email" && r.invited_at && r.invited_at > since));
    const noEmail = (rows || []).filter((r) => !r.email).length;
    const company = mp.company_name || "Your company";

    let sent = 0; const sentIds: string[] = []; let failed = 0;
    for (let i = 0; i < eligible.length; i += 100) {
      const chunk = eligible.slice(i, i + 100);
      const payload = chunk.map((r) => {
        const link = `${SITE}/claim/${r.claim_token}`;
        const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0D1B2A">
<h2 style="color:#0D1B2A">Your SeaMinds seafarer profile is ready</h2>
<p>Hello ${esc(r.rank)} ${esc(r.first_name)},</p>
<p><strong>${esc(company)}</strong> has created your SeaMinds digital seafarer profile from the records held in their office.</p>
<p>Your Crew ID: <strong>${esc(r.crew_unique_id)}</strong></p>
<p><a href="${link}" style="display:inline-block;background:#D4AF37;color:#0D1B2A;font-weight:bold;padding:12px 20px;border-radius:12px;text-decoration:none">Review &amp; accept my profile</a></p>
<p style="font-size:13px;color:#555">If you do not want this profile, open the same link and tap “Decline”. SeaMinds is free for seafarers.</p>
<p style="font-size:13px;color:#555">— The SeaMinds Team</p></div>`;
        const text = `Hello ${r.rank} ${r.first_name},\n\n${company} has created your SeaMinds digital seafarer profile.\nYour Crew ID: ${r.crew_unique_id}\n\nReview and accept (or decline): ${link}\n\nFree for seafarers.\n— The SeaMinds Team`;
        return { from: "SeaMinds <crew@seaminds.life>", reply_to: "support@seaminds.life", to: [r.email], subject: `${company} created your SeaMinds crew profile`, html, text };
      });
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST", headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (res.ok) { sent += chunk.length; sentIds.push(...chunk.map((r) => r.id)); }
      else { failed += chunk.length; console.error("resend batch failed", res.status, await res.text()); }
    }
    if (sentIds.length) {
      const now = new Date().toISOString();
      await svc.from("company_crew_records").update({ invited_at: now, invite_channel: "email" }).in("id", sentIds);
      await svc.from("company_crew_records").update({ status: "invited" }).in("id", sentIds).eq("status", "pending");
    }
    await svc.from("app_events").insert({ event_type: "company_crew_invite_email", severity: failed ? "warning" : "info",
      message: `Company crew invitations: ${sent} accepted by email provider`, metadata: { manager_id: uid, sent, failed, no_email: noEmail } });
    return json({ ok: true, sent, failed, no_email: noEmail, skipped: (rows || []).length - eligible.length - noEmail });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "Could not send invitations. Please try again." }, 500);
  }
});
