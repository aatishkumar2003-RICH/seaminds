// Weekly Maritime Briefing: one blog article per user per week, staggered by weekday so the
// free email quota never spikes. Tue = Indonesia/Vietnam, Wed = Philippines, Thu = India +
// everyone else, Fri = ShipManagers. Topic matched to department; no repeat within 90 days.
// Quota gate: only sends while 24h total stays under CEILING; max RUN_CAP per run.
// GET ?u=<user_id>&s=<sig> = one-click unsubscribe. POST {dry:true} = report only.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SITE = "https://seaminds.life";
const SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const svc = createClient(Deno.env.get("SUPABASE_URL")!, SVC_KEY);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/weekly-briefing`;
const RUN_CAP = 200;
const CEILING = 1400; // paid Resend (50k/month ≈ 1,600/day); leaves headroom for alerts and applications
// Rotating "feature of the week" so crew discover what SeaMinds can do.
function featureBlock(nat: string | null, rank: string | null) {
  const n = (nat || "").toLowerCase();
  const orals = /india/.test(n)
    ? "Preparing for DG Shipping MMD orals or your next promotion? Practise with the SeaMinds AI voice examiner."
    : /filip|philipp/.test(n)
    ? "Preparing for MARINA assessment or promotion? Practise oral questions with the SeaMinds AI voice examiner."
    : "Preparing for a promotion or company interview? Practise with the SeaMinds AI voice examiner.";
  const list = [
    { t: "🎓 Orals & promotion practice", d: orals, u: `${SITE}/maritime-interview` },
    { t: "🧠 SeaMinds Brain", d: "Ask any machinery or navigation question by voice, photo or document — in your language.", u: `${SITE}/training?tab=brain` },
    { t: "🚢 Fleet incident drills", d: "LPG, tanker, bulk, container and reefer drills built on real casualty cases.", u: `${SITE}/training?tab=drills` },
  ];
  const week = Math.floor(Date.now() / (7 * 86400000));
  const f = /engineer|officer|master|mate|\d\/[eo]|c\/[eo]/i.test(rank || "") && week % 2 === 0 ? list[0] : list[week % list.length];
  return `<div style="background:#0D1B2A;border-radius:10px;padding:12px;margin-top:8px"><b style="color:#D4AF37">${f.t}</b><br><span style="color:#CBD5E1;font-size:13px">${f.d}</span><br><a href="${f.u}" style="color:#D4AF37">Try it free →</a></div>`;
}
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sign(id: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SVC_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`brief-unsub:${id}`));
  return Array.from(new Uint8Array(sig)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Region of a crew member from nationality text.
function region(nat?: string | null): "idvn" | "ph" | "rest" {
  const n = (nat || "").toLowerCase();
  if (/indones|vietnam/.test(n)) return "idvn";
  if (/filip|philipp/.test(n)) return "ph";
  return "rest";
}
const lang = (nat?: string | null) => {
  const n = (nat || "").toLowerCase();
  if (/indones/.test(n)) return "id";
  if (/vietnam/.test(n)) return "vi";
  return "en";
};
function topics(rank?: string | null, manager = false): string[] {
  if (manager) return ["psc", "sire", "vetting", "detention", "retention", "crewing", "inspection", "compliance", "manager"];
  const r = (rank || "").toLowerCase();
  if (/engineer|eto|electr|oiler|fitter|motorman|wiper|\d\/e|c\/e/.test(r)) return ["engine", "machinery", "bunker", "fuel", "boiler", "pump", "electric", "maintenance"];
  if (/master|captain|officer|mate|\d\/o|c\/o|cadet/.test(r)) return ["navigation", "bridge", "colreg", "ecdis", "cargo", "weather", "psc", "sire"];
  return ["safety", "seaman", "mlc", "rest hour", "wellness", "mooring", "career", "stcw"];
}

async function sentLast24h() {
  const since = new Date(Date.now() - 86400000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const [a, b, c, d] = await Promise.all([
    svc.from("recruiter_outreach_log").select("id", { count: "exact", head: true }).gte("sent_at", since),
    svc.from("briefing_log").select("id", { count: "exact", head: true }).gte("sent_at", since),
    svc.from("crew_digest_log").select("crew_id", { count: "exact", head: true }).eq("sent_on", today).like("vacancy_key", "day:%"),
    svc.from("manager_engagement_log").select("manager_user_id", { count: "exact", head: true }).eq("sent_on", today),
  ]);
  return (a.count || 0) + (b.count || 0) + (c.count || 0) + (d.count || 0);
}

type Post = { id: string; title: string; slug: string; excerpt: string | null; image_url: string | null; language: string };
let postCache: Record<string, Post[]> = {};
async function posts(l: string): Promise<Post[]> {
  if (!postCache[l]) {
    const { data } = await svc.from("blog_posts").select("id,title,slug,excerpt,image_url,language").eq("published", true).eq("language", l).order("created_at", { ascending: false }).limit(300);
    postCache[l] = (data as Post[]) || [];
  }
  return postCache[l];
}
async function pickPost(userId: string, l: string, kw: string[]): Promise<Post | null> {
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data: prev } = await svc.from("briefing_log").select("post_id").eq("user_id", userId).gte("sent_at", since);
  const seen = new Set((prev || []).map((p: any) => p.post_id));
  for (const lg of l === "en" ? ["en"] : [l, "en"]) {
    const list = (await posts(lg)).filter((p) => !seen.has(p.id));
    const hit = list.find((p) => kw.some((k) => `${p.title} ${p.excerpt || ""}`.toLowerCase().includes(k)));
    if (hit || list[0]) return hit || list[0];
  }
  return null;
}

async function vacancies(rank?: string | null) {
  const r = (rank || "").trim();
  if (r.length < 2) return [];
  const { data } = await svc.from("job_postings").select("id,rank_required,vessel_type,company_name").eq("status", "active").ilike("rank_required", `%${r.replace(/[%_]/g, "")}%`).order("created_at", { ascending: false }).limit(2);
  return data || [];
}

function html(name: string, p: Post, extra: string, unsub: string, manager: boolean) {
  const link = `${SITE}/blog/${p.slug}?utm_source=weekly_briefing&utm_medium=email&utm_campaign=${manager ? "manager" : "crew"}`;
  return `<div style="background:#0D1B2A;padding:24px;font-family:Arial,sans-serif;color:#E2E8F0">
  <div style="max-width:560px;margin:auto;background:#112240;border:1px solid rgba(212,175,55,0.3);border-radius:14px;padding:22px">
  <div style="color:#D4AF37;font-weight:bold;font-size:13px;letter-spacing:1px">⚓ SEAMINDS WEEKLY MARITIME BRIEFING</div>
  <p>Hi ${esc(name || "there")},</p>
  ${p.image_url ? `<img src="${esc(p.image_url)}" alt="" style="width:100%;border-radius:10px;margin:6px 0">` : ""}
  <h2 style="color:#fff;font-size:20px;margin:10px 0">${esc(p.title)}</h2>
  <p style="color:#CBD5E1">${esc((p.excerpt || "").slice(0, 320))}</p>
  <p style="margin:18px 0"><a href="${link}" style="background:#D4AF37;color:#0D1B2A;padding:11px 20px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">Read Full Insight (3 min) →</a></p>
  ${extra}
  <p style="color:#94A3B8;font-size:12px;margin-top:20px">One article a week from SeaMinds. <a href="${unsub}" style="color:#94A3B8">Unsubscribe</a></p>
  </div></div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);

  if (req.method === "GET" && url.searchParams.get("u")) {
    const u = url.searchParams.get("u")!;
    if (!/^[0-9a-f-]{36}$/i.test(u) || url.searchParams.get("s") !== await sign(u)) return new Response("Invalid link", { status: 400 });
    await svc.from("briefing_optout").upsert({ user_id: u });
    return new Response(`<html><body style="background:#0D1B2A;color:#D4AF37;font-family:Arial;text-align:center;padding:60px"><h2>You're unsubscribed</h2><p style="color:#CBD5E1">You will no longer receive the SeaMinds weekly briefing.</p></body></html>`, { headers: { "Content-Type": "text/html" } });
  }
  if (req.method === "POST" && url.searchParams.get("u")) return json({ ok: true }); // one-click POST
  const body = await req.json().catch(() => ({}));

  const dow = new Date(Date.now() + 7 * 3600000).getUTCDay(); // Jakarta weekday
  const forced = typeof body.day === "number" ? body.day : dow;
  const group = ({ 2: "idvn", 3: "ph", 4: "rest", 5: "manager" } as Record<number, string>)[forced];
  if (!group) return json({ skipped: "not_a_briefing_day", dow });

  const used = await sentLast24h();
  if (used >= CEILING && !body.dry) return json({ skipped: "quota_gate", used });

  const { data: out } = await svc.from("briefing_optout").select("user_id");
  const optedOut = new Set((out || []).map((o: any) => o.user_id));
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString();
  const { data: recent } = await svc.from("briefing_log").select("user_id").gte("sent_at", weekAgo);
  const doneWeek = new Set((recent || []).map((r: any) => r.user_id));

  type R = { id: string; email: string; name: string; rank: string | null; nat: string | null; manager: boolean };
  const list: R[] = [];
  if (group === "manager") {
    const { data } = await svc.from("manager_profiles").select("user_id,full_name,company_name,marketing_emails").eq("marketing_emails", true);
    for (const m of data || []) {
      if (!m.user_id || optedOut.has(m.user_id) || doneWeek.has(m.user_id)) continue;
      const { data: u } = await svc.auth.admin.getUserById(m.user_id);
      if (u?.user?.email) list.push({ id: m.user_id, email: u.user.email, name: m.full_name || m.company_name || "", rank: null, nat: null, manager: true });
    }
  } else {
    const { data } = await svc.from("crew_profiles").select("id,email,first_name,rank,role,nationality,is_test").not("email", "is", null);
    for (const c of data || []) {
      if (c.is_test || !c.email || optedOut.has(c.id) || doneWeek.has(c.id)) continue;
      if (region(c.nationality) !== group) continue;
      list.push({ id: c.id, email: c.email, name: c.first_name || "", rank: c.rank || c.role, nat: c.nationality, manager: false });
    }
  }
  const budget = Math.min(RUN_CAP, Math.max(0, CEILING - used));
  const batch = list.slice(0, budget);
  if (body.dry) return json({ group, used, eligible: list.length, would_send: batch.length });

  const stats = { group, used, eligible: list.length, sent: 0, failed: 0 };
  for (const r of batch) {
    const p = await pickPost(r.id, r.manager ? "en" : lang(r.nat), topics(r.rank, r.manager));
    if (!p) continue;
    let extra = "";
    if (r.manager) {
      extra = `<div style="background:#0D1B2A;border-radius:10px;padding:12px;margin-top:8px"><b style="color:#D4AF37">Post a vacancy in 15 seconds</b><br><span style="color:#CBD5E1;font-size:13px">Paste any advert into Vacancy Studio — free.</span><br><a href="${SITE}/post-vacancy" style="color:#D4AF37">Open Vacancy Studio →</a></div>`;
    } else {
      const v = await vacancies(r.rank);
      if (v.length) extra = `<div style="background:#0D1B2A;border-radius:10px;padding:12px;margin-top:8px"><b style="color:#D4AF37">Berths for your rank</b>${v.map((j: any) => `<div style="color:#CBD5E1;font-size:13px;margin-top:6px">• ${esc(j.rank_required)}${j.vessel_type ? ` — ${esc(j.vessel_type)}` : ""}${j.company_name ? ` (${esc(j.company_name)})` : ""}</div>`).join("")}<a href="${SITE}/jobs" style="color:#D4AF37;font-size:13px">See all vacancies →</a></div>`;
      extra += featureBlock(r.nat, r.rank);
    }
    const unsub = `${FN_URL}?u=${r.id}&s=${await sign(r.id)}`;
    let ok = false, error: string | null = null;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "SeaMinds Briefing <crew@seaminds.life>", reply_to: "support@seaminds.life", to: [r.email],
          subject: `⚓ This week: ${p.title}`.slice(0, 150), html: html(r.name, p, extra, unsub, r.manager),
          headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
      });
      ok = res.ok; if (!ok) error = (await res.text()).slice(0, 300);
    } catch (e) { error = String(e).slice(0, 300); }
    await svc.from("briefing_log").insert({ user_id: r.id, audience: r.manager ? "manager" : "crew", post_id: p.id, ok, error });
    if (ok) stats.sent++; else { stats.failed++; if (/quota|rate/i.test(error || "")) break; }
    await new Promise((s) => setTimeout(s, 700));
  }
  console.log("weekly-briefing", stats);
  return json(stats);
});
