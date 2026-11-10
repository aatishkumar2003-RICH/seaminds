import { describe, it, expect } from "vitest";
import { buildShipBulletin } from "../../supabase/functions/_shared/shipBulletin";

const post = {
  title: "IMO Warns Shipping Safety Threats",
  slug: "imo-warns",
  excerpt: "Excerpt",
  content: `<div>AT A GLANCE<ul><li>Point one.</li><li>Point two.</li></ul></div>
<h2>What happened</h2><p>The IMO warned &amp; called for action.</p>
<h2>Why it matters for seafarers and ships</h2><p>Crews face risk.</p>
<h2>What deck officers should do</h2><ul><li><strong>Stay informed</strong>: review notices.</li></ul>
<h2>What engineers should do</h2><ul><li>Test the emergency fire pump.</li></ul>
<img src="https://x/y.jpg">`,
};

describe("ship bulletin", () => {
  const r = buildShipBulletin(post, { vessel: "Arklow Rose", date: new Date("2026-11-10T04:30:00Z"), readUrl: "https://seaminds.life/blog/imo-warns", unsubUrl: "https://seaminds.life/unsubscribe?x" });

  it("is plain text with no HTML or images", () => {
    expect(r.text).not.toMatch(/<[a-z\/]/i);
    expect(r.text).not.toContain("y.jpg");
  });
  it("stays small enough for satellite mail (under 8 KB)", () => {
    expect(new TextEncoder().encode(r.text).length).toBeLessThan(8000);
  });
  it("includes the story, takeaways, vessel and unsubscribe", () => {
    expect(r.text).toContain("The IMO warned & called for action.");
    expect(r.text).toContain("Bridge team: Stay informed: review notices.");
    expect(r.text).toContain("Engine room: Test the emergency fire pump.");
    expect(r.text).toContain("of Arklow Rose");
    expect(r.text).toContain("UNSUBSCRIBE");
    expect(r.text).toContain("The SeaMinds Team");
  });
});
