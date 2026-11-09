// Vessel briefing: twice-weekly (Mon & Thu) forward-ready email to public ship mailboxes.
// Plain, lightweight HTML for satellite mail. Signed "The SeaMinds Team" only (owner rule).
// GET/POST ?c=<id>&s=<sig> = unsubscribe. POST {test_email} (admin JWT) = preview one email.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SITE = "https://seaminds.life";
const SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const svc = createClient(Deno.env.get("SUPABASE_URL")!, SVC_KEY);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/vessel-briefing`;
const RUN_CAP = 400; // per daily run (raise or add a second daily run past ~1,400 ships)
const MIN_GAP_HOURS = 68; // never more than twice a week per ship
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sign(id: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SVC_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`vessel-unsub:${id}`));
  return Array.from(new Uint8Array(sig)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Ctx = { liveJobs: number; posts: { title: string; slug: string }[] };
async function loadCtx(): Promise<Ctx> {
  const [jobs, posts] = await Promise.all([
    svc.from("job_postings").select("id", { count: "exact", head: true }).eq("status", "active"),
    svc.from("blog_posts").select("title,slug").eq("published", true).eq("language", "en").order("created_at", { ascending: false }).limit(3),
  ]);
  return { liveJobs: jobs.count || 0, posts: (posts.data as any) || [] };
}

const link = (p: string) => `${SITE}${p}${p.includes("?") ? "&" : "?"}utm_source=vessel_briefing&utm_medium=email`;

function build(ctx: Ctx, vessel: string | null, unsub: string) {
  const subject = "Daily Maritime News, Worldwide Vacancies & AI Training at Your Hand — For Your Vessel & Crew";
  const news = ctx.posts.length
    ? `<p><b>THIS WEEK ON SEAMINDS</b></p><ul>${ctx.posts.map((p) => `<li><a href="${link(`/blog/${p.slug}`)}">${esc(p.title)}</a></li>`).join("")}</ul>`
    : "";
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#111;max-width:600px">
<p>Dear Captain, Chief Engineer, and Shipboard Team${vessel ? ` of ${esc(vessel)}` : ""},</p>
<p>Greetings from SeaMinds (<a href="${link("/")}">seaminds.life</a>).</p>
<p>We know how vital it is for officers and crew at sea to stay connected with daily news from home, keep professional skills sharp, and plan their next contract with the best worldwide market salaries.</p>
<p><b>1. DAILY MARITIME &amp; HOME COUNTRY NEWS</b><br>Daily headlines from India, the Philippines, Indonesia, Vietnam and global maritime developments, on your phone or the ship's browser.</p>
<p><b>2. WORLDWIDE RANK VACANCIES AT YOUR FINGERTIPS</b><br>${ctx.liveJobs ? `${ctx.liveJobs.toLocaleString("en")} live openings` : "Live openings"} across all ranks and vessel types (Tankers, Bulk Carriers, Containers, Offshore). Compare salary benchmarks and apply directly to recruiters. <a href="${link("/jobs")}">See vacancies</a></p>
<p><b>3. PERSONALIZED MARITIME AI BRAIN &amp; TRAINING</b><br>Instant help on regulations, COLREGs, machinery troubleshooting and SIRE 2.0 inspections, on watch or in the engine room.</p>
<p><b>4. 100% PRIVATE &amp; CONFIDENTIAL</b><br>Career preparation, personal notes and wellness chats stay strictly private.</p>
${news}
<p>------------------------------------------------------------<br><b>HOW TO ACCESS ONBOARD OR ON LEAVE:</b><br>• Web / satellite browser: <a href="${link("/")}">https://seaminds.life</a><br>• Google Play Store: search "SeaMinds" on your Android device<br>------------------------------------------------------------</p>
<p>Captain / Chief: if you find this helpful for life onboard, please feel free to forward this email to your officers and crew so they can stay informed and connected throughout the voyage.</p>
<p>Wishing you and your crew safe seas and smooth watches.</p>
<p>Warm regards,<br><b>The SeaMinds Team</b><br>admin@seaminds.life | seaminds.life</p>
<p style="font-size:11px;color:#666">You receive this because this vessel mailbox is publicly listed. <a href="${unsub}">Stop these emails</a> or reply UNSUBSCRIBE.</p></div>`;
  return { subject, html };
}

async function send(to: string, id: string, vessel: string | null, ctx: Ctx) {
  const unsub = `${FN_URL}?c=${id}&s=${await sign(id)}`;
  const branded = `${SITE}/unsubscribe?f=vessel-briefing&c=${id}&s=${await sign(id)}`;
  const { subject, html } = build(ctx, vessel, branded);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "SeaMinds Team <admin@seaminds.life>", reply_to: "admin@seaminds.life", to: [to], subject, html,
      headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
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
    const r = await send(String(body.test_email).slice(0, 200), "00000000-0000-0000-0000-000000000000", "Sample Vessel", ctx);
    return json(r);
  }

  // Daily run: spread each ship's twice-weekly email evenly over 7 days, random order.
  const { count: active } = await svc.from("vessel_outreach_contacts").select("id", { count: "exact", head: true }).eq("stage", "active");
  const quota = Math.min(RUN_CAP, Math.ceil(((active || 0) * 2) / 7));
  const cutoff = new Date(Date.now() - MIN_GAP_HOURS * 3600000).toISOString();
  const { data: pool } = await svc.from("vessel_outreach_contacts").select("id,email,vessel_name").eq("stage", "active")
    .or(`last_sent_at.is.null,last_sent_at.lt.${cutoff}`).limit(5000);
  const shuffled = [...(pool || [])];
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  const due = shuffled.slice(0, quota);
  const stats = { sent: 0, failed: 0 };
  for (const c of due || []) {
    const r = await send(c.email, c.id, c.vessel_name, ctx);
    if (r.ok) {
      stats.sent++;
      const { data: cur } = await svc.from("vessel_outreach_contacts").select("sends_count").eq("id", c.id).single();
      await svc.from("vessel_outreach_contacts").update({ sends_count: (cur?.sends_count || 0) + 1, last_sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("id", c.id);
    } else {
      stats.failed++;
      const bounced = /invalid|not.*valid|bounce/i.test(r.error || "");
      await svc.from("vessel_outreach_contacts").update({ stage: bounced ? "bounced" : "active", last_error: r.error, last_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", c.id);
    }
    await new Promise((res) => setTimeout(res, 250));
  }
  console.log("vessel-briefing", stats);
  return json(stats);
});
