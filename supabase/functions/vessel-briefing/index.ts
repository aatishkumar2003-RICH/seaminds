// Vessel briefing: DAILY plain-text shipboard bulletin (today's news story) to public ship mailboxes.
// Text only, no attachments/images, for satellite mail. Signed "The SeaMinds Team" only (owner rule).
// GET/POST ?c=<id>&s=<sig> = unsubscribe. POST {test_email} (admin JWT) = preview one email.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { buildShipBulletin, type BulletinPost } from "../_shared/shipBulletin.ts";

const SITE = "https://seaminds.life";
const SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const svc = createClient(Deno.env.get("SUPABASE_URL")!, SVC_KEY);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/vessel-briefing`;
const RUN_CAP = 1000; // per daily run (sent in batches of 50)
const MIN_GAP_HOURS = 20; // one bulletin per ship per day
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sign(id: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SVC_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`vessel-unsub:${id}`));
  return Array.from(new Uint8Array(sig)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Ctx = { post: BulletinPost | null };
async function loadCtx(): Promise<Ctx> {
  // Today's news-briefing story (latest English post from the last 36h).
  const since = new Date(Date.now() - 36 * 3600000).toISOString();
  const { data } = await svc.from("blog_posts").select("title,slug,excerpt,content,created_at")
    .eq("published", true).eq("language", "en").gte("created_at", since).order("created_at", { ascending: false }).limit(1);
  return { post: (data?.[0] as any) || null };
}

const link = (p: string) => `${SITE}${p}${p.includes("?") ? "&" : "?"}utm_source=vessel_briefing&utm_medium=email`;

async function message(to: string, id: string, vessel: string | null, ctx: Ctx) {
  const sig = await sign(id);
  const unsub = `${FN_URL}?c=${id}&s=${sig}`;
  const branded = `${SITE}/unsubscribe?f=vessel-briefing&c=${id}&s=${sig}`;
  const { subject, text } = buildShipBulletin(ctx.post!, { vessel, date: new Date(), readUrl: link(`/blog/${ctx.post!.slug}`), unsubUrl: branded });
  return { from: "SeaMinds Team <admin@seaminds.life>", reply_to: "admin@seaminds.life", to: [to], subject, text,
    headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } };
}

async function sendBatch(msgs: unknown[]) {
  const r = await fetch("https://api.resend.com/emails/batch", {
    method: "POST", headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(msgs),
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, error: r.ok ? null : JSON.stringify(body).slice(0, 300) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const cid = url.searchParams.get("c");
  if (cid) {
    const ok = url.searchParams.get("s") === (await sign(cid));
    if (ok && req.method === "POST") await svc.from("vessel_outreach_contacts").update({ stage: "unsubscribed", updated_at: new Date().toISOString() }).eq("id", cid);
    return new Response(`<html><body style="font-family:Arial;text-align:center;padding:60px">${ok ? (req.method === "POST" ? "<h2>You're unsubscribed</h2>" : `<h2>Stop SeaMinds emails?</h2><form method="POST"><button>Confirm unsubscribe</button></form>`) : "<h2>Invalid link</h2>"}</body></html>`, { headers: { "Content-Type": "text/html" } });
  }
  if (!RESEND_KEY) return json({ error: "email not configured" }, 500);
  const body = await req.json().catch(() => ({}));
  const ctx = await loadCtx();

  if (body.test_email) {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") || "";
    const { data: u } = await svc.auth.getUser(token);
    const { data: isAdmin } = u?.user ? await svc.rpc("is_admin", { _user_id: u.user.id }) : { data: false };
    if (!isAdmin) return json({ error: "admin only" }, 403);
    if (!ctx.post) return json({ error: "no story published in the last 36h" }, 409);
    const r = await sendBatch([await message(String(body.test_email).slice(0, 200), "00000000-0000-0000-0000-000000000000", "Sample Vessel", ctx)]);
    return json(r);
  }

  // Daily run: every active ship gets today's bulletin once (skip if no fresh story).
  if (!ctx.post) return json({ skipped: "no fresh story" });
  const cutoff = new Date(Date.now() - MIN_GAP_HOURS * 3600000).toISOString();
  const { data: pool } = await svc.from("vessel_outreach_contacts").select("id,email,vessel_name").eq("stage", "active")
    .or(`last_sent_at.is.null,last_sent_at.lt.${cutoff}`).order("last_sent_at", { ascending: true, nullsFirst: true }).limit(RUN_CAP);
  const due = pool || [];
  const stats = { sent: 0, failed: 0 };
  for (let i = 0; i < due.length; i += 50) {
    const chunk = due.slice(i, i + 50);
    const msgs = await Promise.all(chunk.map((c) => message(c.email, c.id, c.vessel_name, ctx)));
    const r = await sendBatch(msgs);
    const now = new Date().toISOString();
    const ids = chunk.map((c) => c.id);
    if (r.ok) {
      stats.sent += chunk.length;
      await svc.from("vessel_outreach_contacts").update({ last_sent_at: now, last_error: null, updated_at: now }).in("id", ids);
    } else {
      stats.failed += chunk.length;
      await svc.from("vessel_outreach_contacts").update({ last_error: r.error, last_sent_at: now, updated_at: now }).in("id", ids);
    }
    await new Promise((res) => setTimeout(res, 600));
  }
  console.log("vessel-briefing", stats);
  return json(stats);
});
