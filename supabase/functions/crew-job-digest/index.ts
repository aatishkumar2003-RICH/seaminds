// Daily crew market digest. Runs once a day (cron). Leads with the real live vacancy count
// for the crew member's rank (worldwide, new in 24h, home-country recruiters, ship types),
// plus up to 3 unseen top picks and a "browse all" call-to-action into the app.
// GET ?u=<crew_id>&s=<sig> = one-click unsubscribe (sets job_alerts_enabled=false).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SITE = "https://seaminds.life";
const SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const svc = createClient(Deno.env.get("SUPABASE_URL")!, SVC_KEY);
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/crew-job-digest`;

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const slug = (s?: string | null) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const jobUrl = (id: string, rank?: string | null, vessel?: string | null, port?: string | null) =>
  `${SITE}/jobs/${[slug(rank) || "seafarer", slug(vessel) || "vessel", slug(port) || "worldwide", id].join("-")}`;

async function sign(id: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SVC_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`unsub:${id}`));
  return Array.from(new Uint8Array(sig)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const ALIASES: Record<string, string[]> = {
  master: ["master", "captain", "capt"],
  "chief officer": ["chief officer", "chief mate", "c/o", "first officer", "1st officer"],
  "second officer": ["second officer", "2nd officer", "2/o", "second mate"],
  "third officer": ["third officer", "3rd officer", "3/o", "third mate"],
  bosun: ["bosun", "boatswain"],
  "able seaman": ["able seaman", "able bodied", "ab "],
  "ordinary seaman": ["ordinary seaman"],
  "chief engineer": ["chief engineer", "c/e", "chief eng"],
  "second engineer": ["second engineer", "2nd engineer", "2/e"],
  "third engineer": ["third engineer", "3rd engineer", "3/e"],
  "fourth engineer": ["fourth engineer", "4th engineer", "4/e"],
  eto: ["eto", "electro technical", "electrical officer"],
  fitter: ["fitter"],
  oiler: ["oiler", "motorman", "wiper"],
  cook: ["cook", "chef"],
  messman: ["messman", "steward"],
  "deck cadet": ["deck cadet"],
  "engine cadet": ["engine cadet"],
};
const canon = (raw?: string | null) => {
  const r = ` ${(raw || "").toLowerCase().trim()} `;
  if (!r.trim()) return null;
  for (const [k, a] of Object.entries(ALIASES)) if (a.some((x) => r.includes(x))) return k;
  return r.trim();
};

// Crew nationality -> recruiter origin code used by vacancy_origin_of().
const NAT: Record<string, { code: string; name: string }> = {
  indian: { code: "in", name: "Indian" }, india: { code: "in", name: "Indian" },
  indonesian: { code: "id", name: "Indonesian" }, indonesia: { code: "id", name: "Indonesian" },
  filipino: { code: "ph", name: "Philippine" }, philippines: { code: "ph", name: "Philippine" }, philippine: { code: "ph", name: "Philippine" },
  ukrainian: { code: "ua", name: "Ukrainian" }, ukraine: { code: "ua", name: "Ukrainian" },
  vietnamese: { code: "vn", name: "Vietnamese" }, vietnam: { code: "vn", name: "Vietnamese" },
  german: { code: "de", name: "German" }, germany: { code: "de", name: "German" },
  russian: { code: "ru", name: "Russian" }, russia: { code: "ru", name: "Russian" },
};

type Vac = { key: string; id: string; rank: string; vessel: string | null; port: string | null; company: string | null; salary: string | null; posted: string };

const card = (inner: string) => `<div style="font-family:Arial,sans-serif;background:#0D1B2A;padding:24px;color:#e2e8f0"><div style="max-width:560px;margin:0 auto;background:#112240;border:1px solid rgba(212,175,55,0.3);border-radius:14px;padding:22px">${inner}</div></div>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);

  // ---- unsubscribe
  const u = url.searchParams.get("u");
  if (u) {
    const ok = /^[0-9a-f-]{36}$/i.test(u) && url.searchParams.get("s") === await sign(u);
    if (ok) await svc.from("crew_profiles").update({ job_alerts_enabled: false }).eq("id", u);
    return new Response(
      `<html><body style="font-family:Arial;background:#0D1B2A;color:#fff;text-align:center;padding:60px">${ok ? "You will no longer receive daily job matches from SeaMinds. You can turn them back on in the app." : "This link is not valid."}<p><a style="color:#D4AF37" href="${SITE}">SeaMinds</a></p></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  // ---- once per day guard
  const today = new Date().toISOString().slice(0, 10);
  const { count: doneToday } = await svc.from("crew_digest_log").select("crew_id", { count: "exact", head: true }).eq("sent_on", today);
  const force = url.searchParams.get("dry") === "1";
  if ((doneToday ?? 0) > 0 && !force) return Response.json({ skipped: "already_ran_today" }, { headers: corsHeaders });
  if (!RESEND_KEY && !force) return Response.json({ skipped: "no_provider_key" }, { headers: corsHeaders });

  const since = new Date(Date.now() - 3 * 86400000).toISOString();
  const [{ data: jp }, { data: ev }] = await Promise.all([
    svc.from("job_postings").select("id,rank_required,vessel_type,joining_port,company_name,recruiter_name,monthly_salary,created_at")
      .eq("status", "active").gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
    svc.from("external_vacancies").select("id,rank_required,title,vessel_type,joining_port,company_name,salary_text,created_at,is_scam_flagged,archived_at")
      .gte("created_at", since).is("archived_at", null).order("created_at", { ascending: false }).limit(1000),
  ]);
  const vacs: Vac[] = [
    ...(jp || []).map((r: any) => ({ key: `jp:${r.id}`, id: r.id, rank: r.rank_required, vessel: r.vessel_type, port: r.joining_port, company: r.recruiter_name && !/not disclosed/i.test(r.recruiter_name) ? r.recruiter_name : r.company_name, salary: r.monthly_salary, posted: r.created_at })),
    ...(ev || []).filter((r: any) => !r.is_scam_flagged).map((r: any) => ({ key: `ev:${r.id}`, id: r.id, rank: r.rank_required || r.title, vessel: r.vessel_type, port: r.joining_port, company: r.company_name, salary: r.salary_text, posted: r.created_at })),
  ].filter((v) => v.rank);

  // Real live-market scale per rank (all active vacancies, never age-filtered).
  const { data: agg } = await svc.rpc("digest_rank_stats");
  type RS = { total: number; fresh: number; byOrigin: Record<string, number>; byVessel: Record<string, number> };
  const rankStats = new Map<string, RS>();
  for (const a of (agg as any[]) || []) {
    const k = canon(a.rank_raw); if (!k) continue;
    const s = rankStats.get(k) || { total: 0, fresh: 0, byOrigin: {}, byVessel: {} };
    const n = Number(a.n) || 0;
    s.total += n; if (a.fresh) s.fresh += n;
    s.byOrigin[a.origin] = (s.byOrigin[a.origin] || 0) + n;
    s.byVessel[a.vessel_bucket] = (s.byVessel[a.vessel_bucket] || 0) + n;
    rankStats.set(k, s);
  }
  for (const v of vacs) if (v.key.startsWith("ev:")) { const k = canon(v.rank); const s = k && rankStats.get(k); if (s) s.total++; }

  const { data: crew } = await svc.from("crew_profiles").select("id,first_name,rank,role,preferred_vessel_types,nationality").eq("job_alerts_enabled", true);
  const stats = { crew: crew?.length || 0, sent: 0, no_match: 0, failed: 0, no_email: 0 };

  for (const c of crew || []) {
    const cr = canon(c.rank || c.role);
    if (!cr) { stats.no_match++; continue; }
    const { data: prev } = await svc.from("crew_digest_log").select("vacancy_key").eq("crew_id", c.id);
    const seen = new Set((prev || []).map((p: any) => p.vacancy_key));
    const prefs = (Array.isArray(c.preferred_vessel_types) ? c.preferred_vessel_types : []).map((s: string) => s.toLowerCase());
    const picks = vacs
      .filter((v) => !seen.has(v.key) && canon(v.rank) === cr)
      .map((v) => ({ v, s: (prefs.some((p: string) => (v.vessel || "").toLowerCase().includes(p.split(" ")[0])) ? 2 : 0) + (v.salary ? 1 : 0) }))
      .sort((a, b) => b.s - a.s || b.v.posted.localeCompare(a.v.posted))
      .slice(0, 3).map((x) => x.v);
    const rs = rankStats.get(cr);
    if (!picks.length && !(rs && rs.fresh > 0)) { stats.no_match++; continue; }

    const { data: au } = await svc.auth.admin.getUserById(c.id);
    const email = au?.user?.email;
    if (!email) { stats.no_email++; continue; }
    if (force) { stats.sent++; continue; }

    const unsub = `${FN_URL}?u=${c.id}&s=${await sign(c.id)}`;
    const rankLabel = c.rank || c.role || "your rank";
    const total = rs?.total || picks.length;
    const totalTxt = total >= 100 ? `${Math.floor(total / 10) * 10}+` : String(total);
    const home = NAT[(c.nationality || "").toLowerCase().trim()];
    const homeN = home ? rs?.byOrigin[home.code] || 0 : 0;
    const vesselLine = Object.entries(rs?.byVessel || {}).filter(([k, n]) => k !== "Other" && n > 0)
      .sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ");
    const utmD = (p: string, c2: string) => `${SITE}${p}${p.includes("?") ? "&" : "?"}utm_source=digest&utm_medium=email&utm_campaign=${c2}`;
    const tile = (n: string | number, l: string) => `<td style="padding:10px;text-align:center;background:#0D1B2A;border-radius:10px"><div style="color:#D4AF37;font-size:22px;font-weight:bold">${esc(n)}</div><div style="color:#94A3B8;font-size:11px">${esc(l)}</div></td>`;
    const rows = picks.map((v) => `
      <div style="border:1px solid #1e3a5f;border-radius:10px;padding:12px;margin:10px 0">
        <p style="margin:0;color:#fff;font-weight:bold">${esc(v.rank)}${v.vessel ? ` · ${esc(v.vessel)}` : ""}</p>
        <p style="margin:4px 0 8px;color:#94A3B8;font-size:13px">${[v.company, v.port, v.salary].filter(Boolean).map(esc).join(" · ") || "Details in the advert"}</p>
        <a href="${jobUrl(v.id, v.rank, v.vessel, v.port)}?utm_source=digest&utm_medium=email&utm_campaign=pick" style="color:#D4AF37;font-weight:bold;text-decoration:none">View &amp; apply →</a>
      </div>`).join("");
    const html = card(`
      <p style="margin:0 0 6px;color:#D4AF37;font-size:12px;font-weight:bold;letter-spacing:1px">SEAMINDS DAILY MARKET · ${esc(rankLabel).toUpperCase()}</p>
      <h2 style="color:#fff;margin:0 0 6px">⚓ ${esc(totalTxt)} ${esc(rankLabel)} vacancies are live right now</h2>
      <p style="margin:0 0 8px">Hi ${esc(c.first_name || "there")}, this is the real size of today's market for your rank on SeaMinds — not just a few adverts.</p>
      <table width="100%" cellspacing="6" style="margin:12px 0"><tr>${tile(totalTxt, "live worldwide")}${tile(rs?.fresh || 0, "new in 24 hours")}${home ? tile(homeN, `from ${home.name} recruiters`) : ""}</tr></table>
      ${vesselLine ? `<p style="color:#94A3B8;font-size:13px;margin:4px 0 12px">By ship type: ${esc(vesselLine)}</p>` : ""}
      <a href="${utmD("/feed", "browse_all_top")}" style="background:#D4AF37;color:#0D1B2A;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">Browse all ${esc(totalTxt)} ${esc(rankLabel)} jobs →</a>
      ${rows ? `<h3 style="color:#D4AF37;margin:20px 0 4px;font-size:15px">Today's top picks for you</h3>${rows}` : ""}
      <div style="margin-top:18px;padding:12px;border-radius:10px;background:#0D1B2A;border:1px solid rgba(212,175,55,0.3)">
        <p style="margin:0;color:#fff;font-weight:bold">Stand out to recruiters</p>
        <p style="margin:4px 0 8px;color:#94A3B8;font-size:13px">A complete CV, your certificates with expiry dates and a SeaMinds Score help recruiters shortlist you faster.</p>
        <a href="${utmD("/app?tab=profile", "profile_hook")}" style="color:#D4AF37;font-weight:bold;text-decoration:none">Update my Sea Profile →</a>
      </div>
      <p style="margin-top:14px;color:#94A3B8;font-size:13px">Know a shipmate looking for a berth? Forward this email — joining SeaMinds is free.</p>
      <p style="color:#94A3B8;font-size:12px;margin-top:18px">Counts include every active advert on SeaMinds; always confirm details with the recruiter. SeaMinds never charges seafarers for jobs.<br>You get this because job alerts are on in your SeaMinds profile. <a href="${unsub}" style="color:#94A3B8">Unsubscribe</a></p>`);

    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "SeaMinds Jobs <crew@seaminds.life>", to: [email],
          subject: `⚓ ${c.first_name ? `${c.first_name}, ` : ""}${totalTxt} ${rankLabel} jobs live today${rs?.fresh ? ` (${rs.fresh} new in 24h)` : ""}`,
          html, headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        }),
      });
      if (!r.ok) { stats.failed++; console.error("digest send failed", r.status, await r.text()); continue; }
      await svc.from("crew_digest_log").insert([...picks.map((v) => ({ crew_id: c.id, vacancy_key: v.key, sent_on: today })), { crew_id: c.id, vacancy_key: `day:${today}`, sent_on: today }]);
      stats.sent++;
      await new Promise((res) => setTimeout(res, 600)); // stay under provider rate limit
    } catch (e) { stats.failed++; console.error("digest error", e); }
  }
  console.log("digest", stats);
  return Response.json({ ok: true, dry: force, ...stats }, { headers: corsHeaders });
});
