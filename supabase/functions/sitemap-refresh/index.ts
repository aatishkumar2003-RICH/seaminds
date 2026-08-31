import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const BASE = "https://seaminds.life";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const slugify = (s: string | null | undefined) =>
  (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

const jobPath = (r: { id: string; rank?: string | null; vessel?: string | null; port?: string | null }) =>
  `/jobs/${[slugify(r.rank) || "seafarer", slugify(r.vessel) || "vessel", slugify(r.port) || "worldwide", r.id].join("-")}`;

const RANK_SLUGS = [
  "master", "chief-officer", "2nd-officer", "3rd-officer", "chief-engineer", "2nd-engineer",
  "3rd-engineer", "4th-engineer", "eto", "bosun", "ab", "os", "fitter", "oiler", "cook", "messman",
];

const COUNTRY_SLUGS = [
  "india", "philippines", "indonesia", "vietnam", "ukraine", "bangladesh",
  "myanmar", "sri-lanka", "greece", "uae", "singapore",
];

const STATIC_PAGES: { path: string; freq: string; pri: string }[] = [
  { path: "/", freq: "weekly", pri: "1.0" },
  { path: "/feed", freq: "daily", pri: "0.9" },
  { path: "/for-companies", freq: "weekly", pri: "0.8" },
  { path: "/pricing", freq: "weekly", pri: "0.7" },
  { path: "/colleges", freq: "weekly", pri: "0.6" },
  { path: "/blog", freq: "weekly", pri: "0.8" },
  { path: "/join", freq: "weekly", pri: "0.8" },
  { path: "/profile-start", freq: "weekly", pri: "0.7" },
  ...RANK_SLUGS.map((s) => ({ path: `/jobs/rank/${s}`, freq: "daily", pri: "0.8" })),
  ...COUNTRY_SLUGS.map((s) => ({ path: `/jobs/country/${s}`, freq: "daily", pri: "0.7" })),
];

const urlNode = (loc: string, lastmod: string | null, freq: string, pri: string) =>
  `  <url>\n    <loc>${esc(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}\n    <changefreq>${freq}</changefreq>\n    <priority>${pri}</priority>\n  </url>`;

const day = (v: string | null | undefined) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
};

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-secret",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const AGENT_SECRET = Deno.env.get("AGENT_SECRET");
  const provided = req.headers.get("x-agent-secret") || new URL(req.url).searchParams.get("secret");
  if (!AGENT_SECRET || provided !== AGENT_SECRET) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const nowIso = new Date().toISOString();
  const today = nowIso.split("T")[0];

  let direct: any[] = [];
  let external: any[] = [];
  let posts: any[] = [];

  try {
    const [p, e, b] = await Promise.all([
      supabase.from("job_postings")
        .select("id, rank_required, vessel_type, joining_port, created_at, expires_at, status")
        .eq("status", "active").gt("expires_at", nowIso)
        .order("created_at", { ascending: false }).limit(5000),
      supabase.from("external_vacancies")
        .select("id, rank_required, title, vessel_type, joining_port, fetched_at, expires_at, is_scam_flagged")
        .gt("expires_at", nowIso)
        .order("fetched_at", { ascending: false }).limit(5000),
      supabase.from("blog_posts")
        .select("slug, updated_at, created_at")
        .eq("published", true).not("slug", "is", null)
        .order("created_at", { ascending: false }).limit(200),
    ]);
    direct = p.data || [];
    external = (e.data || []).filter((r: any) => !r.is_scam_flagged);
    posts = b.data || [];
  } catch { /* still serve static pages */ }

  const urls = [
    ...STATIC_PAGES.map((s) => urlNode(`${BASE}${s.path}`, today, s.freq, s.pri)),
    ...direct.map((r: any) =>
      urlNode(`${BASE}${jobPath({ id: r.id, rank: r.rank_required, vessel: r.vessel_type, port: r.joining_port })}`,
        day(r.created_at), "daily", "0.8")),
    ...external.map((r: any) =>
      urlNode(`${BASE}${jobPath({ id: r.id, rank: r.rank_required || r.title, vessel: r.vessel_type, port: r.joining_port })}`,
        day(r.fetched_at), "daily", "0.7")),
    ...posts.map((p: any) =>
      urlNode(`${BASE}/blog/${p.slug}`, day(p.updated_at || p.created_at), "monthly", "0.7")),
  ].join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  return new Response(xml, {
    headers: { ...cors, "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
});
