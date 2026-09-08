import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SITE = "https://seaminds.life";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const esc = (v: unknown) =>
  String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

const toText = (html: string) =>
  html
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2: $1")
    .replace(/<\/(p|div|h2|h3|li|ol|ul)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const LANGS: Record<string, string> = {
  en: "English", vi: "Vietnamese", tl: "Tagalog", hi: "Hindi", id: "Bahasa Indonesia",
};

async function logEvent(campaignId: string, recipient: string, ok: boolean, extra: Record<string, unknown> = {}) {
  try {
    await svc.from("app_events").insert({
      event_type: "interview_invite_email",
      severity: ok ? "info" : "warning",
      message: ok ? "Interview invitation emailed" : "Interview invitation email failed",
      metadata: { campaign_id: campaignId, recipient, ok, ...extra },
    });
  } catch (_e) { /* never break the flow */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const auth = req.headers.get("Authorization") || "";
    const jwt = auth.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ ok: false, error: "Please sign in again." }, 401);

    const { data: userData, error: userErr } = await svc.auth.getUser(jwt);
    const uid = userData?.user?.id;
    if (userErr || !uid) return json({ ok: false, error: "Please sign in again." }, 401);

    const body = await req.json().catch(() => ({}));
    const campaignId = String(body?.campaign_id || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const name = body?.name ? String(body.name).trim().slice(0, 120) : null;

    if (!campaignId) return json({ ok: false, error: "Missing interview." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ ok: false, error: "Enter a valid email address." }, 400);

    const { data: camp } = await svc
      .from("interview_campaigns")
      .select("id, manager_id, company_name, title, rank_required, vessel_type, language, closes_at, status, open_link_token")
      .eq("id", campaignId)
      .maybeSingle();

    if (!camp) return json({ ok: false, error: "Interview not found." }, 404);
    if (camp.manager_id !== uid) return json({ ok: false, error: "You do not own this interview." }, 403);
    if (camp.status !== "open") return json({ ok: false, error: "This interview is closed." }, 400);

    // Idempotency — same campaign + email in the last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await svc.from("app_events").select("id")
      .eq("event_type", "interview_invite_email")
      .filter("metadata->>campaign_id", "eq", campaignId)
      .filter("metadata->>recipient", "eq", email)
      .filter("metadata->>ok", "eq", "true")
      .gte("created_at", since)
      .limit(1);
    if (recent && recent.length > 0) return json({ ok: true, skipped: "already_sent" });

    // Reuse the campaign's own token generator for the candidate link
    let token: string | null = null;
    const { data: tok } = await svc.rpc("make_invite_token");
    token = (tok as string) || null;
    if (!token) token = crypto.randomUUID().replace(/-/g, "").slice(0, 24);

    const { data: invite, error: invErr } = await svc.from("interview_invites").insert({
      campaign_id: campaignId,
      token,
      invited_email: email,
      invited_name: name,
      status: "sent",
    }).select("id, token").maybeSingle();

    if (invErr || !invite) {
      await logEvent(campaignId, email, false, { error: invErr?.message?.slice(0, 200) || "invite_insert_failed" });
      return json({ ok: false, error: invErr?.message || "Could not create the invitation." }, 200);
    }

    const link = `${SITE}/interview/${invite.token}`;
    const lang = LANGS[camp.language] || camp.language || "English";
    const validUntil = camp.closes_at
      ? new Date(camp.closes_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "14 days";

    const html = `<div style="background:#0D1B2A;border-radius:14px;padding:24px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;line-height:1.6">
  <h2 style="color:#D4AF37;font-size:18px;margin:0 0 12px">${esc(camp.company_name)} has invited you to an asynchronous AI crew interview</h2>
  ${name ? `<p style="margin:0 0 10px">Dear ${esc(name)},</p>` : ""}
  <p style="margin:0 0 4px"><strong style="color:#D4AF37">Rank:</strong> ${esc(camp.rank_required)}</p>
  <p style="margin:0 0 4px"><strong style="color:#D4AF37">Vessel type:</strong> ${esc(camp.vessel_type || "Any vessel")}</p>
  <p style="margin:0 0 4px"><strong style="color:#D4AF37">Mode:</strong> online written questions in ${esc(lang)} — Maritime English is assessed separately</p>
  <p style="margin:0 0 4px"><strong style="color:#D4AF37">Estimated time:</strong> 15 minutes</p>
  <p style="margin:0 0 16px"><strong style="color:#D4AF37">Valid until:</strong> ${esc(validUntil)}</p>
  <p><a href="${link}" style="background:#D4AF37;color:#0D1B2A;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Start my interview</a></p>
  <p style="color:#94A3B8;font-size:13px;margin-top:16px">No payment is ever requested. Questions? Reply to this email.</p>
  <p style="color:#94A3B8;font-size:12px;margin-top:22px">Sent via SeaMinds — seaminds.life · free crew platform, no agent fees</p>
</div>`;

    if (!RESEND_KEY) {
      await logEvent(campaignId, email, false, { invite_id: invite.id, skipped: "no_provider_key" });
      return json({ ok: false, error: "Email service is not configured." });
    }

    let ok = false;
    let error: string | null = null;
    let providerId: string | null = null;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "SeaMinds <crew@seaminds.life>",
          to: [email],
          subject: `Interview invitation via SeaMinds — ${camp.rank_required}`,
          html,
          text: toText(html),
        }),
      });
      const rb = await r.json().catch(() => ({}));
      ok = r.ok;
      providerId = (rb as any)?.id ?? null;
      if (!ok) error = `[${r.status}] ${String((rb as any)?.message || (rb as any)?.error || "").slice(0, 200)}`;
    } catch (e) {
      ok = false;
      error = e instanceof Error ? e.message.slice(0, 200) : "network_error";
    }

    await logEvent(campaignId, email, ok, { invite_id: invite.id, provider_id: providerId, error });

    return json(ok ? { ok: true, invite_id: invite.id, link } : { ok: false, error: error || "send_failed" });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Unexpected error" });
  }
});
