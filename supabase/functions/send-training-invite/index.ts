import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (v: string) => v.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
// Only SeaMinds links become clickable; everything else stays plain text.
const linkify = (line: string) => esc(line).replace(/https:\/\/(seaminds\.life|[a-z0-9-]+\.lovable\.app)[^\s<]*/g, (u) => `<a href="${u}" style="color:#D4AF37">${u}</a>`);

async function log(uid: string, recipient: string, ok: boolean, extra: Record<string, unknown> = {}) {
  try { await svc.from("app_events").insert({ event_type: "training_invite_email", severity: ok ? "info" : "warning", message: ok ? "Training invitation emailed" : "Training invitation email failed", metadata: { manager_user_id: uid, recipient, ok, ...extra } }); } catch { /* never break */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const { data: u } = jwt ? await svc.auth.getUser(jwt) : { data: null as any };
    const uid = u?.user?.id;
    if (!uid) return json({ ok: false, error: "Please sign in again." }, 401);

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const message = String(body?.message || "").slice(0, 8000);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ ok: false, error: "Enter a valid crew email address." }, 400);
    if (message.trim().length < 20) return json({ ok: false, error: "Choose at least one training item first." }, 400);

    const { data: mp } = await svc.from("manager_profiles").select("id, company_name").eq("user_id", uid).maybeSingle();
    if (!mp) return json({ ok: false, error: "Only company accounts can send training invitations." }, 403);
    const company = String((mp as any).company_name || body?.company || "Your company").slice(0, 120);

    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const { data: recent } = await svc.from("app_events").select("metadata").eq("event_type", "training_invite_email")
      .filter("metadata->>manager_user_id", "eq", uid).filter("metadata->>ok", "eq", "true").gte("created_at", dayAgo).limit(200);
    if ((recent?.length || 0) >= 150) return json({ ok: false, error: "Daily email limit reached (150). Use WhatsApp, Zalo or Copy for more crew today." });
    const tenMin = Date.now() - 600000;
    if ((recent || []).some((r: any) => r.metadata?.recipient === email && Date.parse(r.metadata?.at || "") > tenMin)) return json({ ok: true, skipped: "already_sent" });

    if (!RESEND_KEY) { await log(uid, email, false, { skipped: "no_provider_key" }); return json({ ok: false, error: "Email service is not configured." }); }

    const html = `<div style="background:#0D1B2A;border-radius:14px;padding:24px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;line-height:1.6">
  <h2 style="color:#D4AF37;font-size:18px;margin:0 0 12px">🎓 ${esc(company)} — pre-joining training</h2>
  ${message.split("\n").map((l) => `<p style="margin:0 0 6px">${linkify(l) || "&nbsp;"}</p>`).join("")}
  <p style="margin:18px 0"><a href="https://seaminds.life/training" style="background:#D4AF37;color:#0D1B2A;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Open My training</a></p>
  <p style="color:#94A3B8;font-size:13px">Sign in or create your free account with this email address so ${esc(company)} can see your progress. Need help? support@seaminds.life</p>
  <p style="color:#94A3B8;font-size:12px;margin-top:18px">Sent via SeaMinds — seaminds.life · free for crew</p></div>`;

    let ok = false, error: string | null = null, providerId: string | null = null;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "SeaMinds <crew@seaminds.life>", to: [email], subject: `${company} — pre-joining training on SeaMinds`, html, text: `${message}\n\nOpen My training: https://seaminds.life/training\n\nSent via SeaMinds — free for crew.` }),
      });
      const rb: any = await r.json().catch(() => ({}));
      ok = r.ok; providerId = rb?.id ?? null;
      if (!ok) error = `[${r.status}] ${String(rb?.message || rb?.error || "").slice(0, 200)}`;
    } catch (e) { error = e instanceof Error ? e.message.slice(0, 200) : "network_error"; }

    await log(uid, email, ok, { provider_id: providerId, error, at: new Date().toISOString() });
    return json(ok ? { ok: true } : { ok: false, error: "The email could not be sent. Please retry or use WhatsApp / Zalo." });
  } catch (e) { return json({ ok: false, error: e instanceof Error ? e.message : "Unexpected error" }); }
});
