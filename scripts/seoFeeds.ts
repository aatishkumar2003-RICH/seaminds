// Build-time RSS + sitemap generator. Pure helpers are tested; fetch runs in vite.config.ts.
export type FeedPost = { slug: string; title: string; excerpt?: string | null; content?: string | null; image_url?: string | null; created_at: string; updated_at?: string | null; language?: string | null };

const BASE = "https://seaminds.life";
export const xmlEsc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const plain = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export function buildRss(posts: FeedPost[]): string {
  const items = posts.filter((p) => p.slug && p.title).map((p) => {
    const url = `${BASE}/blog/${encodeURI(p.slug)}`;
    const desc = (p.excerpt || plain(p.content || "")).slice(0, 300);
    const img = p.image_url ? `\n      <media:content url="${xmlEsc(p.image_url)}" medium="image" width="1200"/>` : "";
    return `    <item>
      <title>${xmlEsc(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(p.created_at).toUTCString()}</pubDate>
      <description>${xmlEsc(desc)}</description>
      <dc:creator>SeaMinds</dc:creator>${img}
    </item>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>SeaMinds — Maritime News &amp; Seafarer Insights</title>
    <link>${BASE}/blog</link>
    <description>Maritime insights, seafarer rights, jobs and training for crew worldwide.</description>
    <language>en</language>
    <image><url>${BASE}/icon-512.png</url><title>SeaMinds</title><link>${BASE}</link></image>
    <atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

const RANKS = ["master","chief-officer","2nd-officer","3rd-officer","chief-engineer","2nd-engineer","3rd-engineer","4th-engineer","eto","bosun","ab","os","fitter","oiler","cook","messman"];
const COUNTRIES = ["india","philippines","indonesia","vietnam","ukraine","bangladesh","myanmar","sri-lanka","greece","uae","singapore"];
const STATIC = ["/","/feed","/blog","/for-companies","/pricing","/colleges","/join","/profile-start","/guide",
  ...RANKS.map((r) => `/jobs/rank/${r}`), ...COUNTRIES.map((c) => `/jobs/country/${c}`)];

// lastmod only from a real per-article timestamp; static pages carry none.
export function buildSitemap(posts: FeedPost[]): string {
  const node = (loc: string, lastmod?: string) =>
    `  <url>\n    <loc>${xmlEsc(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}\n  </url>`;
  const day = (v?: string | null) => { const d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : undefined; };
  const urls = [
    ...STATIC.map((p) => node(`${BASE}${p}`)),
    ...posts.filter((p) => p.slug).map((p) => node(`${BASE}/blog/${encodeURI(p.slug)}`, day(p.updated_at || p.created_at))),
  ].join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
