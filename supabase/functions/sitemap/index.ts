import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

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

Deno.serve(async () => {
  const nowIso = new Date().toISOString();

  const staticPages = [
    { loc: "https://seaminds.life/", freq: "daily", pri: "1.0" },
    { loc: "https://seaminds.life/feed", freq: "hourly", pri: "0.9" },
    { loc: "https://seaminds.life/blog", freq: "daily", pri: "0.9" },
    { loc: "https://seaminds.life/for-companies", freq: "monthly", pri: "0.8" },
    { loc: "https://seaminds.life/pricing", freq: "monthly", pri: "0.7" },
    { loc: "https://seaminds.life/colleges", freq: "monthly", pri: "0.6" },
    { loc: "https://seaminds.life/contact", freq: "monthly", pri: "0.5" },
    { loc: "https://seaminds.life/terms", freq: "yearly", pri: "0.3" },
    { loc: "https://seaminds.life/privacy", freq: "yearly", pri: "0.3" },
    ...RANK_SLUGS.map((s) => ({ loc: `https://seaminds.life/jobs/rank/${s}`, freq: "daily", pri: "0.8" })),
    ...COUNTRY_SLUGS.map((s) => ({ loc: `https://seaminds.life/jobs/country/${s}`, freq: "daily", pri: "0.7" })),
  ];

  let posts: any[] = [];
  let direct: any[] = [];
  let external: any[] = [];

  try {
    const [b, p, e] = await Promise.all([
      supabase.from("blog_posts")
        .select("slug, updated_at, created_at")
        .eq("published", true).not("slug", "is", null)
        .order("created_at", { ascending: false }).limit(5000),
      supabase.from("job_postings")
        .select("id, rank_required, vessel_type, joining_port, created_at, expires_at, status")
        .eq("status", "active").order("created_at", { ascending: false }).limit(5000),
      supabase.from("external_vacancies")
        .select("id, rank_required, title, vessel_type, joining_port, fetched_at, expires_at, is_scam_flagged")
        .gt("expires_at", nowIso).order("fetched_at", { ascending: false }).limit(5000),
    ]);
    posts = b.data || [];
    // expired postings are dropped automatically
    direct = (p.data || []).filter((r: any) => !r.expires_at || r.expires_at > nowIso);
    external = (e.data || []).filter((r: any) => !r.is_scam_flagged);
  } catch { /* still serve static pages */ }

  const jobUrl = (path: string, lastmod: string | null) =>
    `  <url>\n    <loc>https://seaminds.life${esc(path)}</loc>${lastmod ? `\n    <lastmod>${new Date(lastmod).toISOString().split("T")[0]}</lastmod>` : ""}\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`;

  const urls = [
    ...staticPages.map((p) =>
      `  <url>\n    <loc>${p.loc}</loc>\n    <changefreq>${p.freq}</changefreq>\n    <priority>${p.pri}</priority>\n  </url>`),
    ...direct.map((r: any) =>
      jobUrl(jobPath({ id: r.id, rank: r.rank_required, vessel: r.vessel_type, port: r.joining_port }), r.created_at)),
    ...external.map((r: any) =>
      jobUrl(jobPath({ id: r.id, rank: r.rank_required || r.title, vessel: r.vessel_type, port: r.joining_port }), r.fetched_at)),
    ...posts.map((p: any) =>
      `  <url>\n    <loc>https://seaminds.life/blog/${esc(p.slug)}</loc>\n    <lastmod>${new Date(p.updated_at || p.created_at).toISOString().split("T")[0]}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`),
  ].join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
