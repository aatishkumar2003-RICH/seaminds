import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { angle } = await req.json().catch(() => ({ angle: "jobs" }));
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) return json({ success: false, error: "AI unavailable" });

    // Pull live facts so the content is specific, never generic
    const [{ data: jobs, count }, { data: article }, { data: post }] = await Promise.all([
      supabase.from("external_vacancies")
        .select("rank_required, vessel_type, company_name, salary_text, joining_port", { count: "exact" })
        .order("fetched_at", { ascending: false }).limit(8),
      supabase.from("blog_posts").select("title, excerpt, slug")
        .eq("published", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("company_posts").select("company_name, caption")
        .eq("status", "live").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const facts = {
      totalJobs: count ?? 0,
      recentJobs: (jobs || []).map((j: any) =>
        [j.rank_required, j.vessel_type, j.salary_text, j.joining_port].filter(Boolean).join(" · ")),
      latestArticle: article ? { title: (article as any).title, slug: (article as any).slug } : null,
      latestCompanyPost: post ? (post as any).caption?.slice(0, 200) : null,
    };

    const ANGLES: Record<string, string> = {
      jobs: "Today's live vacancies. Lead with a specific rank, vessel and salary from the real data.",
      scam: "Seafarers being asked to pay fees for jobs. Under MLC 2006 this is illegal. Take a clear side.",
      score: "The SeaMinds Competency Score and why companies sort crew by it. Appeal to professional pride.",
      truth: "The unspoken hard part of life at sea — isolation, missed family moments. Honest, never pitying.",
      article: "Today's new guide. Teach one genuinely useful thing, then point to the full article.",
      company: "Aimed at manning companies and crewing managers, not seafarers. Professional tone.",
    };

    const prompt = `You write short-form social content for SeaMinds, a free maritime jobs and welfare platform for seafarers. The founder is a Master Mariner who holds RPSL crewing licences.

TODAY'S REAL DATA — use these exact specifics, never invent numbers:
${JSON.stringify(facts, null, 1)}

ANGLE: ${ANGLES[angle] || ANGLES.jobs}

Write content that actually performs in 2026 short-form. Rules:
- HOOK IN THE FIRST 5 WORDS. A specific number, a blunt claim, or a question that stings. Never start with "Are you a seafarer?" or any soft opener.
- Be SPECIFIC. "2nd Officer, bulk carrier, $4,200, joining Singapore" beats "great opportunities available".
- Write like a person typing on a phone, not a brand. Short lines. No corporate voice. No "Elevate your career".
- Give a reason to comment: an opinion, a question crew will argue about, or something they will tag a shipmate on.
- Never use the words: unlock, elevate, seamless, revolutionary, empower, journey.
- No fake urgency, no fake scarcity.

Return ONLY JSON, no markdown:
{
  "tiktok": {"hook": "first 5 words on screen", "script": "15-20 second spoken script, 3-4 short beats, each on its own line", "onscreen": ["text overlay 1","text overlay 2","text overlay 3"], "caption": "caption under 150 chars", "hashtags": "8-11 hashtags mixing big and niche"},
  "instagram": {"caption": "caption with line breaks, 60-120 words, hook first line", "hashtags": "8-11 hashtags"},
  "x": {"post": "under 260 characters, punchy, one idea, no hashtags except maybe one"},
  "linkedin": {"post": "120-180 words, professional but not stiff, aimed at crewing managers, one clear takeaway"},
  "whatsapp": {"message": "short message a seafarer would actually forward to a shipmate, under 300 chars"}
}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    try {
      const parsed = JSON.parse(String(raw).replace(/```json|```/g, "").trim());
      return json({ success: true, angle, facts, content: parsed });
    } catch {
      return json({ success: false, error: "Could not generate. Try again." });
    }
  } catch (e) {
    return json({ success: false, error: String(e).substring(0, 150) });
  }
});
