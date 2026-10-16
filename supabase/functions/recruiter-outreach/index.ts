// Recruiter outreach engine (cold-but-honest, low-volume, stops on reply/join/unsubscribe).
// Daily run: sync contacts from live vacancies -> send at most DAILY_CAP emails, each contact
// gets one email per due date. Sequence: 4 intro touches, then a fortnightly nurture rotation
// (vacancy report <-> blog digest <-> new idea). All figures are real counts from the database.
// GET ?c=<contact_id>&s=<sig> = one-click unsubscribe. POST {test_email} (admin JWT) = preview all touches.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SITE = "https://seaminds.life";
const SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const svc = createClient(Deno.env.get("SUPABASE_URL")!, SVC_KEY);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/recruiter-outreach`;
const DAILY_CAP = 30;
const GAP_DAYS = [0, 4, 5, 7]; // wait before touch 2,3,4 (index = touches already sent)
const NURTURE_DAYS = 14;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sign(id: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SVC_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`rec-unsub:${id}`));
  return Array.from(new Uint8Array(sig)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Contact = { id: string; email: string; recruiter_name: string | null; active_vacancies: number; applications_total: number; top_ranks: string[]; touches_sent: number; last_kind: string | null };
// STRICT: no crew headcount is ever loaded or shown to recruiters.
type Stats = { liveJobs: number; apps30: number; countries: number; posts: { title: string; slug: string; excerpt: string | null }[] };

async function loadStats(): Promise<Stats> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [jobs, apps, posts, origins] = await Promise.all([
    svc.from("job_postings").select("id", { count: "exact", head: true }).eq("status", "active"),
    svc.from("job_applications").select("id", { count: "exact", head: true }).gte("created_at", since),
    svc.from("blog_posts").select("title,slug,excerpt").eq("published", true).eq("language", "en").order("created_at", { ascending: false }).limit(3),
    svc.rpc("vacancy_origin_counts"),
  ]);
  const countries = Array.isArray(origins.data) ? origins.data.length : 0;
  return { liveJobs: jobs.count || 0, apps30: apps.count || 0, countries, posts: (posts.data as any) || [] };
}

const utm = (path: string, c: string) => `${SITE}${path}${path.includes("?") ? "&" : "?"}utm_source=recruiter_outreach&utm_medium=email&utm_campaign=${c}`;
const btn = (href: string, label: string) => `<p style="margin:18px 0 6px"><a href="${href}" style="background:#D4AF37;color:#0D1B2A;padding:11px 20px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">${esc(label)}</a></p>`;
const stat = (n: number | string, l: string) => `<td style="padding:10px;text-align:center;background:#0D1B2A;border-radius:10px"><div style="color:#D4AF37;font-size:22px;font-weight:bold">${esc(n)}</div><div style="color:#94A3B8;font-size:11px">${esc(l)}</div></td>`;
const statRow = (s: Stats) => `<table width="100%" cellspacing="6" style="margin:14px 0"><tr>${stat(s.liveJobs, "live vacancies")}${stat(s.apps30, "applications / 30 days")}${stat(s.countries, "hiring countries")}</tr></table>`;

function build(kind: string, c: Contact, s: Stats) {
  const hi = `Hi ${esc(c.recruiter_name || "there")},`;
  const ranks = c.top_ranks.slice(0, 3).join(", ");
  const yours = c.active_vacancies > 0
    ? `SeaMinds is currently showing <b style="color:#fff">${c.active_vacancies}</b> of your vacancies${ranks ? ` (${esc(ranks)})` : ""} to seafarers${c.applications_total ? `, and they have received <b style="color:#fff">${c.applications_total}</b> application${c.applications_total > 1 ? "s" : ""} so far` : ""}.`
    : `Your past vacancies were shared with seafarers on SeaMinds.`;
  const T: Record<string, { subject: string; body: string; cta: [string, string] }> = {
    intro: { subject: `${c.active_vacancies || "Your"} vacancies are already reaching seafarers on SeaMinds`,
      body: `<p>${hi}</p><p>${yours}</p><p>Applications go straight to you — by email or WhatsApp, exactly as you published. No fee, no middleman.</p><p>Claim a free ShipManager account to see who applied, edit or close your adverts and post new ones.</p>`,
      cta: ["Claim my vacancies", "/manager"] },
    paste: { subject: "Post a vacancy in 15 seconds — just paste it",
      body: `<p>${hi}</p><p>No forms. Paste your WhatsApp message, email or flyer into <b style="color:#fff">Vacancy Studio</b> — SeaMinds splits every rank, keeps your contact on each one and publishes the ones you tick.</p><p>Many adverts in one paste work too.</p>`,
      cta: ["Try one paste", "/post-vacancy"] },
    proof: { subject: `This month on SeaMinds: ${s.apps30} applications sent to recruiters`,
      body: `<p>${hi}</p><p>Real numbers from the last 30 days:</p>${statRow(s)}<p>${yours}</p><p>Candidates can also take a rank-specific AI assessment, so you can shortlist by verified skill score.</p>`,
      cta: ["See my applicants", "/manager/dashboard?tab=applicants"] },
    last: { subject: "Should I keep sharing your vacancies?",
      body: `<p>${hi}</p><p>Quick one: we will keep showing your public adverts to seafarers. If you'd like them edited, removed, or want applications filtered by SeaMinds Score, just reply to this email — a real person reads it.</p>`,
      cta: ["Open ShipManager", "/manager"] },
    report: { subject: `Your SeaMinds vacancy report — ${new Date().toLocaleString("en", { month: "long" })}`,
      body: `<p>${hi}</p><p>${yours}</p>${statRow(s)}<p>Fresh adverts get the most clicks — re-post or update yours in one paste.</p>`,
      cta: ["Update my vacancies", "/post-vacancy"] },
    blog: { subject: s.posts[0] ? `Maritime read: ${s.posts[0].title}` : "Maritime insights from SeaMinds",
      body: `<p>${hi}</p><p>Worth a few minutes this week:</p>${s.posts.map((p) => `<p style="margin:10px 0"><a href="${utm(`/blog/${p.slug}`, "blog")}" style="color:#D4AF37;font-weight:bold;text-decoration:none">${esc(p.title)}</a><br><span style="color:#94A3B8;font-size:13px">${esc((p.excerpt || "").slice(0, 160))}</span></p>`).join("") || "<p>New articles every week on seafarer careers and crewing.</p>"}`,
      cta: ["More articles", "/blog"] },
    interview: { subject: "Let AI run the first interview round for you",
      body: `<p>${hi}</p><p>Send one link to many candidates. SeaMinds AI interviews them on technical knowledge, judgement and maritime English, then gives you a ranked shortlist.</p>`,
      cta: ["See AI Interviews", "/manager/interviews"] },
  };
  const t = T[kind];
  return { subject: t.subject, inner: `${t.body}${btn(utm(t.cta[1], kind), t.cta[0])}` };
}

const INTRO = ["intro", "paste", "proof", "last"];
const NURTURE = ["report", "blog", "interview"];
const nextKind = (c: Contact) => c.touches_sent < INTRO.length ? INTRO[c.touches_sent]
  : NURTURE[(Math.max(0, NURTURE.indexOf(c.last_kind || "")) + (NURTURE.includes(c.last_kind || "") ? 1 : 0)) % NURTURE.length];

async function send(to: string, c: Contact, kind: string, s: Stats) {
  const { subject, inner } = build(kind, c, s);
  const unsub = `${FN_URL}?c=${c.id}&s=${await sign(c.id)}`;
  const html = `<div style="font-family:Arial,sans-serif;background:#0D1B2A;padding:24px;color:#e2e8f0"><div style="max-width:560px;margin:0 auto;background:#112240;border:1px solid rgba(212,175,55,0.3);border-radius:14px;padding:22px;line-height:1.55"><p style="margin:0 0 12px;color:#D4AF37;font-size:12px;font-weight:bold;letter-spacing:1px">SHIPMANAGER BY SEAMINDS</p>${inner}<p style="margin-top:18px">— SeaMinds Team</p><p style="color:#94A3B8;font-size:11px;margin-top:18px">You get this because your vacancy contact appears in public maritime job adverts shared on SeaMinds. Reply anytime. <a href="${unsub}" style="color:#94A3B8">Stop these emails</a></p></div></div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "SeaMinds Team <admin@seaminds.life>", reply_to: "admin@seaminds.life", to: [to], subject, html,
      headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, subject, id: body?.id as string | undefined, error: r.ok ? null : JSON.stringify(body).slice(0, 300) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const cid = url.searchParams.get("c");
  if (cid) {
    const ok = url.searchParams.get("s") === (await sign(cid));
    if (ok) await svc.from("recruiter_outreach_contacts").update({ stage: "unsubscribed", updated_at: new Date().toISOString() }).eq("id", cid);
    return new Response(`<html><body style="font-family:Arial;background:#0D1B2A;color:#e2e8f0;text-align:center;padding:60px"><h2 style="color:#D4AF37">${ok ? "You're unsubscribed" : "Invalid link"}</h2><p>${ok ? "SeaMinds will not email you again." : "Please reply to the email instead."}</p></body></html>`, { headers: { "Content-Type": "text/html" } });
  }
  if (!RESEND_KEY) return json({ error: "email not configured" }, 500);
  const body = await req.json().catch(() => ({}));

  // Admin preview: send all touches to a test address.
  if (body.test_email || body.dry) {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") || "";
    const { data: u } = await svc.auth.getUser(token);
    const { data: isAdmin } = u?.user ? await svc.rpc("is_admin", { _user_id: u.user.id }) : { data: false };
    if (!isAdmin) return json({ error: "admin only" }, 403);
    const s = await loadStats();
    if (body.dry) {
      await svc.rpc("recruiter_outreach_sync");
      const { count } = await svc.from("recruiter_outreach_contacts").select("id", { count: "exact", head: true }).in("stage", ["new", "engaging", "nurture"]).lte("next_due_at", new Date().toISOString());
      return json({ due: count, cap: DAILY_CAP, stats: s });
    }
    const to = String(body.test_email).slice(0, 200);
    const sample: Contact = { id: "00000000-0000-0000-0000-000000000000", email: to, recruiter_name: "Sample Crewing Agency", active_vacancies: 12, applications_total: 7, top_ranks: ["Chief Officer", "2nd Engineer"], touches_sent: 0, last_kind: null };
    const out = [];
    for (const k of [...INTRO, ...NURTURE]) { out.push({ k, ...(await send(to, sample, k, s)) }); await new Promise((r) => setTimeout(r, 700)); }
    return json({ sent: out.map((o) => ({ kind: o.k, ok: o.ok })) });
  }

  // Daily run (cron).
  const sync = await svc.rpc("recruiter_outreach_sync");
  const s = await loadStats();
  const { data: due } = await svc.from("recruiter_outreach_contacts").select("*").in("stage", ["new", "engaging", "nurture"])
    .lte("next_due_at", new Date().toISOString()).order("touches_sent").order("active_vacancies", { ascending: false }).limit(DAILY_CAP);
  const stats = { sync: sync.data, sent: 0, failed: 0 };
  for (const c of (due || []) as Contact[]) {
    const kind = nextKind(c);
    const r = await send(c.email, c, kind, s);
    await svc.from("recruiter_outreach_log").insert({ contact_id: c.id, kind, subject: r.subject, provider_id: r.id, ok: r.ok, error: r.error });
    if (r.ok) {
      const n = c.touches_sent + 1;
      const wait = n < INTRO.length ? GAP_DAYS[n] : NURTURE_DAYS;
      await svc.from("recruiter_outreach_contacts").update({ touches_sent: n, last_kind: kind, last_contacted_at: new Date().toISOString(),
        stage: n < INTRO.length ? "engaging" : "nurture", next_due_at: new Date(Date.now() + wait * 86400000).toISOString(), updated_at: new Date().toISOString() }).eq("id", c.id);
      stats.sent++;
    } else {
      stats.failed++;
      const bounced = /invalid|not.*valid|bounce/i.test(r.error || "");
      await svc.from("recruiter_outreach_contacts").update({ stage: bounced ? "bounced" : undefined, next_due_at: new Date(Date.now() + 86400000).toISOString() }).eq("id", c.id);
    }
    await new Promise((res) => setTimeout(res, 800));
  }
  console.log("recruiter-outreach", stats);
  return json(stats);
});
