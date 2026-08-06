import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

Deno.serve(async () => {
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
  ];

  let posts: any[] = [];
  try {
    const { data } = await supabase
      .from("blog_posts")
      .select("slug, updated_at, created_at")
      .eq("published", true)
      .not("slug", "is", null)
      .order("created_at", { ascending: false })
      .limit(5000);
    posts = data || [];
  } catch { /* still serve static pages */ }

  const urls = [
    ...staticPages.map((p) =>
      `  <url>\n    <loc>${p.loc}</loc>\n    <changefreq>${p.freq}</changefreq>\n    <priority>${p.pri}</priority>\n  </url>`),
    ...posts.map((p) =>
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
