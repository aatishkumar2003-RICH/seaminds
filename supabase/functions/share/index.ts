import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const SITE = "https://seaminds.life";
const DEFAULT_IMAGE = `${SITE}/og-image.png`;

const esc = (s: string) =>
  String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CRAWLERS = [
  "facebookexternalhit", "facebookcatalog", "whatsapp", "telegrambot", "twitterbot",
  "linkedinbot", "slackbot", "discordbot", "pinterest", "redditbot", "embedly",
  "skypeuripreview", "bingbot", "applebot", "vkshare", "line-podcast", "googlebot",
];

const isCrawler = (ua: string) => {
  const u = (ua || "").toLowerCase();
  return CRAWLERS.some((c) => u.includes(c));
};

function page(meta: { title: string; description: string; image: string; url: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}"/>
<link rel="canonical" href="${esc(meta.url)}"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="SeaMinds"/>
<meta property="og:title" content="${esc(meta.title)}"/>
<meta property="og:description" content="${esc(meta.description)}"/>
<meta property="og:image" content="${esc(meta.image)}"/>
<meta property="og:image:width" content="1080"/>
<meta property="og:image:height" content="1080"/>
<meta property="og:url" content="${esc(meta.url)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(meta.title)}"/>
<meta name="twitter:description" content="${esc(meta.description)}"/>
<meta name="twitter:image" content="${esc(meta.image)}"/>
<meta http-equiv="refresh" content="0; url=${esc(meta.url)}"/>
</head>
<body style="font-family:system-ui;background:#0D1B2A;color:#fff;text-align:center;padding:40px">
<p>Opening SeaMinds…</p>
<p><a href="${esc(meta.url)}" style="color:#D4AF37">${esc(meta.title)}</a></p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "app";
  const slug = url.searchParams.get("slug") || "";
  const id = url.searchParams.get("id") || "";
  const ua = req.headers.get("user-agent") || "";

  let meta = {
    title: "Seafarer Jobs, Crew Wellness & Verified Maritime Talent | SeaMinds",
    description: "Live maritime vacancies, apply by WhatsApp in one tap, build your verified CV and get your competency score. Free for seafarers worldwide.",
    image: DEFAULT_IMAGE,
    url: `${SITE}/join`,
  };

  try {
    if (type === "blog" && slug) {
      const { data } = await supabase
        .from("blog_posts")
        .select("title, excerpt, image_url, slug")
        .eq("slug", slug)
        .maybeSingle();
      if (data) {
        meta = {
          title: `${data.title} | SeaMinds`,
          description: data.excerpt || "A practical guide for working seafarers from SeaMinds.",
          image: data.image_url || DEFAULT_IMAGE,
          url: `${SITE}/blog/${data.slug}`,
        };
      }
    } else if (type === "job" && id) {
      const { data } = await supabase
        .from("external_vacancies")
        .select("rank_required, vessel_type, company_name, salary_text, joining_port")
        .eq("id", id)
        .maybeSingle();
      if (data) {
        const bits = [data.vessel_type, data.company_name].filter(Boolean).join(" · ");
        meta = {
          title: `${data.rank_required || "Crew"} wanted${data.vessel_type ? ` — ${data.vessel_type}` : ""} | SeaMinds`,
          description: [bits, data.salary_text, data.joining_port ? `Joining ${data.joining_port}` : ""]
            .filter(Boolean).join(" · ") || "Apply free on SeaMinds — no agent fees.",
          image: `${Deno.env.get("SUPABASE_URL")}/functions/v1/vacancy-card?id=${id}&source=external`,
          url: `${SITE}/feed`,
        };
      }
    } else if (type === "jobs") {
      const { count } = await supabase
        .from("external_vacancies")
        .select("*", { count: "exact", head: true });
      meta = {
        title: `${count ?? ""} Live Maritime Vacancies — Apply Free | SeaMinds`,
        description: "New seafarer jobs added every 2 hours. Deck, engine, catering and cadets. Apply direct on WhatsApp — no agent fees.",
        image: `${Deno.env.get("SUPABASE_URL")}/functions/v1/vacancy-card?mode=digest`,
        url: `${SITE}/feed`,
      };
    }
  } catch { /* fall back to defaults */ }

  // Real people go straight to the site; crawlers get the preview page.
  if (!isCrawler(ua)) {
    return new Response(null, { status: 302, headers: { ...cors, Location: meta.url } });
  }

  return new Response(page(meta), {
    headers: { ...cors, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" },
  });
});
