import { describe, it, expect } from "vitest";
import { buildRss, buildSitemap } from "../../scripts/seoFeeds";
const p = { slug: "a-b", title: "Rights & Pay", excerpt: "x", image_url: "https://i/x.jpg", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-05T00:00:00Z" };
describe("seo feeds", () => {
  it("rss lists each article with escaped title and image", () => {
    const x = buildRss([p]);
    expect(x).toContain("<link>https://seaminds.life/blog/a-b</link>");
    expect(x).toContain("Rights &amp; Pay");
    expect(x).toContain('media:content url="https://i/x.jpg"');
  });
  it("sitemap uses article timestamp, static pages get no lastmod", () => {
    const x = buildSitemap([p]);
    expect(x).toContain("<loc>https://seaminds.life/blog/a-b</loc>\n    <lastmod>2026-10-05</lastmod>");
    expect(x).toMatch(/<loc>https:\/\/seaminds\.life\/<\/loc>\n  <\/url>/);
  });
});
