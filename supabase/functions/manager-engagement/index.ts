// Daily ShipManager engagement. Max ONE email per manager per day:
//  1) Candidate Match Alert — newly available crew matching the manager's active vacancy ranks
//     (counts + ranks only; never names or contacts — approval gate stays in the app).
//  2) Otherwise the next step of the feature series (day 1/3/6/9/14 after registration).
// GET ?u=<user_id>&s=<sig> = one-click unsubscribe (manager_profiles.marketing_emails=false).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SITE = "https://seaminds.life";
const SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const svc = createClient(Deno.env.get("SUPABASE_URL")!, SVC_KEY);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/manager-engagement`;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function sign(id: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SVC_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`mgr-unsub:${id}`));
  return Array.from(new Uint8Array(sig)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const ALIASES: Record<string, string[]> = {
  master: ["master", "captain", "capt"], "chief officer": ["chief officer", "chief mate", "c/o"],
  "second officer": ["second officer", "2nd officer", "2/o"], "third officer": ["third officer", "3rd officer", "3/o"],
  bosun: ["bosun", "boatswain"], "able seaman": ["able seaman", "able bodied", "ab "], "ordinary seaman": ["ordinary seaman"],
  "chief engineer": ["chief engineer", "c/e"], "second engineer": ["second engineer", "2nd engineer", "2/e"],
  "third engineer": ["third engineer", "3rd engineer", "3/e"], "fourth engineer": ["fourth engineer", "4th engineer", "4/e"],
  eto: ["eto", "electro technical", "electrical officer"], fitter: ["fitter"], oiler: ["oiler", "motorman", "wiper"],
  cook: ["cook", "chef"], messman: ["messman", "steward"], "deck cadet": ["deck cadet"], "engine cadet": ["engine cadet"],
};
const canon = (raw?: string | null) => {
  const r = ` ${(raw || "").toLowerCase().trim()} `;
  if (!r.trim()) return null;
  for (const [k, a] of Object.entries(ALIASES)) if (a.some((x) => r.includes(x))) return k;
  return r.trim();
};
const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

const SERIES: { day: number; kind: string; subject: string; head: string; body: string; cta: string; path: string }[] = [
  { day: 1, kind: "series:studio", subject: "Post all your vacancies in one paste", head: "Bulk Vacancy Studio",
    body: "Paste a whole WhatsApp or Telegram message, an email or up to five flyers. SeaMinds separates every vacancy, keeps the right contact on each one and lets you publish the ready ones in one click.", cta: "Open Vacancy Studio", path: "/post-vacancy" },
  { day: 3, kind: "series:smc", subject: "See verified skill scores before you call a seafarer", head: "SMC competency scores",
    body: "Many SeaMinds crew carry an SMC score from a rank-specific assessment. Use it to shortlist faster and spend interview time only on strong candidates.", cta: "View your applicants", path: "/manager/dashboard?tab=applicants" },
  { day: 6, kind: "series:interviews", subject: "Let AI run your first interview round", head: "AI Interview Studio",
    body: "Create one interview link, send it to many candidates and get a ranked leaderboard with technical, judgment and English scores.", cta: "Open AI Interview Studio", path: "/manager/interviews" },
  { day: 9, kind: "series:search", subject: "Find available crew by rank and vessel type", head: "Crew Search",
    body: "Search seafarers by rank, vessel experience and availability date. Access opens after a quick account approval by our team.", cta: "Open Crew Search", path: "/manager-search" },
  { day: 14, kind: "series:workspace", subject: "One workspace for your fleet", head: "Ship Management Workspace",
    body: "Takeover inspections, findings and fleet records in one place for your technical team. Request access and our team will set it up with you.", cta: "Request Fleet Workspace", path: "/management/inspections" },
];

const card = (inner: string) => `<div style="font-family:Arial,sans-serif;background:#0D1B2A;padding:24px;color:#e2e8f0"><div style="max-width:560px;margin:0 auto;background:#112240;border:1px solid rgba(212,175,55,0.3);border-radius:14px;padding:22px"><p style="margin:0 0 12px;color:#D4AF37;font-size:12px;font-weight:bold;letter-spacing:1px">SHIPMANAGER BY SEAMINDS</p>${inner}</div></div>`;
const btn = (href: string, label: string) => `<p style="margin-top:16px"><a href="${href}" style="background:#D4AF37;color:#0D1B2A;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">${esc(label)}</a></p>`;
const utm = (path: string, c: string) => `${SITE}${path}${path.includes("?") ? "&" : "?"}utm_source=manager_email&utm_medium=email&utm_campaign=${c}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);

  const u = url.searchParams.get("u");
  if (u) {
    const ok = /^[0-9a-f-]{36}$/i.test(u) && url.searchParams.get("s") === await sign(u);
    if (ok) await svc.from("manager_profiles").update({ marketing_emails: false } as any).eq("user_id", u);
    return new Response(`<html><body style="font-family:Arial;background:#0D1B2A;color:#fff;text-align:center;padding:60px">${ok ? "You will no longer receive ShipManager tips and match alerts. Application notices still arrive as usual." : "This link is not valid."}<p><a style="color:#D4AF37" href="${SITE}">SeaMinds</a></p></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const dry = url.searchParams.get("dry") === "1";
  const today = new Date().toISOString().slice(0, 10);
  const { count: doneToday } = await svc.from("manager_engagement_log").select("kind", { count: "exact", head: true }).eq("sent_on", today);
  if ((doneToday ?? 0) > 0 && !dry) return Response.json({ skipped: "already_ran_today" }, { headers: corsHeaders });
  if (!RESEND_KEY && !dry) return Response.json({ skipped: "no_provider_key" }, { headers: corsHeaders });

  const { data: mgrs } = await svc.from("manager_profiles").select("user_id,full_name,company_name,created_at,marketing_emails").eq("marketing_emails", true);
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: crew } = await svc.from("crew_profiles").select("id,rank,role,is_available,updated_at").eq("is_available", true).gte("updated_at", since).limit(2000);
  const stats = { managers: mgrs?.length || 0, match_alerts: 0, series: 0, nothing: 0, no_email: 0, failed: 0 };

  for (const m of mgrs || []) {
    const { data: logs } = await svc.from("manager_engagement_log").select("kind").eq("manager_user_id", m.user_id);
    const sent = new Set((logs || []).map((l: any) => l.kind));
    let subject = "", inner = "", kinds: string[] = [], type: "match" | "series" | null = null;

    // 1) candidate match alert
    const { data: jobs } = await svc.from("job_postings").select("rank_required").eq("manager_id", m.user_id).eq("status", "active").limit(500);
    const ranks = new Set((jobs || []).map((j: any) => canon(j.rank_required)).filter(Boolean) as string[]);
    if (ranks.size) {
      const fresh = (crew || []).filter((c: any) => c.id !== m.user_id && !sent.has(`match:${c.id}`) && ranks.has(canon(c.rank || c.role) || ""));
      if (fresh.length) {
        // STRICT: never disclose real crew counts to managers — qualitative wording only.
        const rankSet = Array.from(new Set(fresh.map((c: any) => canon(c.rank || c.role)!))).slice(0, 6);
        const list = rankSet.map((r) => `<li style="margin:4px 0"><b style="color:#fff">${esc(title(r))}</b> — various crew available</li>`).join("");
        subject = "Various crew are available matching your open vacancies";
        inner = `<h2 style="color:#D4AF37;margin:0 0 8px">🎯 New crew matches</h2><p>Hi ${esc(m.full_name || "there")}, various crew marked themselves available this week for ranks you are hiring for:</p><ul style="padding-left:18px">${list}</ul><p style="color:#94A3B8;font-size:13px">Names and contact details are shown only inside ShipManager to approved accounts.</p>${btn(utm("/manager/dashboard?tab=applicants", "match_alert"), "See matching crew")}`;
        kinds = fresh.map((c: any) => `match:${c.id}`);
        type = "match";
      }
    }
    // 2) feature series
    if (!type) {
      const age = (Date.now() - new Date(m.created_at).getTime()) / 86400000;
      const step = SERIES.find((s) => age >= s.day && !sent.has(s.kind));
      if (step) {
        subject = step.subject;
        inner = `<h2 style="color:#D4AF37;margin:0 0 8px">${esc(step.head)}</h2><p>Hi ${esc(m.full_name || "there")},</p><p>${esc(step.body)}</p>${btn(utm(step.path, step.kind.replace(":", "_")), step.cta)}`;
        kinds = [step.kind];
        type = "series";
      }
    }
    if (!type) { stats.nothing++; continue; }

    const { data: au } = await svc.auth.admin.getUserById(m.user_id);
    const email = au?.user?.email;
    if (!email) { stats.no_email++; continue; }
    if (dry) { type === "match" ? stats.match_alerts++ : stats.series++; continue; }

    const unsub = `${FN_URL}?u=${m.user_id}&s=${await sign(m.user_id)}`;
    const html = card(`${inner}<p style="color:#94A3B8;font-size:12px;margin-top:18px">You get this because you have a ShipManager account${m.company_name ? ` for ${esc(m.company_name)}` : ""}. Reply to this email if you need help. <a href="${unsub}" style="color:#94A3B8">Unsubscribe</a></p>`);
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "ShipManager by SeaMinds <admin@seaminds.life>", reply_to: "support@seaminds.life", to: [email], subject, html,
          headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        }),
      });
      if (!r.ok) { stats.failed++; console.error("mgr send failed", r.status, await r.text()); continue; }
      await svc.from("manager_engagement_log").upsert(kinds.map((k) => ({ manager_user_id: m.user_id, kind: k, sent_on: today })));
      type === "match" ? stats.match_alerts++ : stats.series++;
      await new Promise((res) => setTimeout(res, 600));
    } catch (e) { stats.failed++; console.error("mgr error", e); }
  }
  console.log("manager-engagement", stats);
  return Response.json({ ok: true, dry, ...stats }, { headers: corsHeaders });
});
