import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-secret",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const LANGUAGES = [
  { code: "en", name: "English", note: "Write in clear simple English." },
  { code: "vi", name: "Vietnamese", note: "Write entirely in Vietnamese (Tiếng Việt), natural and professional." },
  { code: "tl", name: "Tagalog", note: "Write entirely in Tagalog, natural for Filipino seafarers." },
  { code: "hi", name: "Hindi", note: "Write entirely in Hindi (Devanagari script), natural for Indian seafarers." },
  { code: "id", name: "Indonesian", note: "Write entirely in Bahasa Indonesia, natural for Indonesian seafarers." },
];

const TOPICS = [
  "How to calculate MLC 2006 rest hours correctly",
  "Seaman CV format 2026: what manning companies actually look for",
  "How to become an ETO on ships: qualifications and career path",
  "Panama seaman book: how to apply and renew",
  "STCW certificates explained for new seafarers",
  "How to prepare your vessel and yourself for a PSC inspection",
  "Best vessel types for deck cadets to start a career",
  "Homesickness at sea: practical ways seafarers cope",
  "Understanding your Seafarer Employment Agreement before you sign",
  "Tanker vs bulk carrier: which is better for your career",
  "How to get your first job as a deck cadet",
  "SIRE 2.0 explained: what it means for crew on tankers",
  "Medical certificate requirements for seafarers worldwide",
  "How to negotiate salary as a seafarer",
  "Fatigue management on board: your rights under STCW",
  "Documents every seafarer needs before joining a vessel",
  "MARPOL basics every crew member must know",
  "Signing off: the checklist before you leave the vessel",
  "How to stay fit and healthy on board a ship",
  "What is a Continuous Discharge Certificate and why it matters",
  "How to avoid maritime job scams and fake manning agents",
  "Working on LNG carriers: what officers need to know",
];


const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const AGENT_SECRET = Deno.env.get("AGENT_SECRET");
  if (AGENT_SECRET) {
    const provided = req.headers.get("x-agent-secret") || new URL(req.url).searchParams.get("secret");
    if (provided !== AGENT_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    // Pick the first topic+language pair that has not been published yet
    const { data: existing } = await supabase.from("blog_posts").select("slug");
    const used = new Set((existing || []).map((r: any) => r.slug));

    let topic: string | null = null;
    let lang = LANGUAGES[0];
    outer:
    for (const t of TOPICS) {
      for (const L of LANGUAGES) {
        const candidate = L.code === "en" ? slugify(t) : `${slugify(t)}-${L.code}`;
        if (!used.has(candidate)) { topic = t; lang = L; break outer; }
      }
    }

    if (!topic) {
      return new Response(JSON.stringify({ success: true, skipped: "all topics used" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const slug = lang.code === "en" ? slugify(topic) : `${slugify(topic)}-${lang.code}`;

    // Write the article with GPT-4o-mini
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1800,
        messages: [{
          role: "user",
          content: `Write a helpful article for working seafarers titled "${topic}".

LANGUAGE: ${lang.note} The title, excerpt and the entire article body must be in ${lang.name}.

Rules:
- 700-900 words, written for seafarers whose first language may not be English. Use simple, clear sentences.
- Practical and specific. Reference real regulations (MLC 2006, STCW, SOLAS, MARPOL) where relevant and accurate.
- Structure with 4-6 short section headings using markdown ##.
- No fluff, no marketing, no invented statistics. If you are unsure of a fact, describe the general rule instead of inventing numbers.
- End with a short practical checklist of 3-5 bullet points.

Return ONLY valid JSON, no markdown fences:
{"title": "...", "excerpt": "one sentence summary under 160 characters", "content": "the full article in markdown"}`,
        }],
      }),
    });

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

    // Fetch a maritime image (optional)
    let imageUrl: string | null = null;
    try {
      const key = Deno.env.get("UNSPLASH_ACCESS_KEY");
      if (key) {
        const imgRes = await fetch(
          `https://api.unsplash.com/photos/random?query=ship%20ocean%20maritime&orientation=landscape&client_id=${key}`,
        );
        const img = await imgRes.json();
        imageUrl = img?.urls?.regular || null;
      }
    } catch { /* image is optional */ }

    
    const { error: insErr } = await supabase.from("blog_posts").insert({
      title: parsed.title || topic,
      content: parsed.content,
      excerpt: parsed.excerpt || null,
      slug,
      image_url: imageUrl,
      language: lang.code,
      region: "global",
      published: true,
    });
    if (insErr) throw insErr;

    // Announce it on Telegram so it reaches people immediately
    const TG = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const CHANNEL = Deno.env.get("TELEGRAM_BLOG_CHANNEL")
      || Deno.env.get("TELEGRAM_CHANNEL")
      || "@seamindsjobs";
    if (TG) {
      try {
        await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: CHANNEL,
            parse_mode: "HTML",
            text: `⚓ <b>New Article</b>\n\n<b>${parsed.title || topic}</b>\n\n${parsed.excerpt || ""}\n\n#seafarer #maritime #seaminds #crewlife${lang.code !== "en" ? ` #${lang.name.toLowerCase()}` : ""}\n\n👉 ${Deno.env.get("SUPABASE_URL")}/functions/v1/share?type=blog&slug=${slug}`,
          }),
        });
      } catch { /* telegram is optional */ }
    }

    await supabase.from("app_events").insert({
      event_type: "blog_published",
      message: `Blog published: ${parsed.title || topic}`,
      severity: "info",
      emailed: true,
      metadata: { slug },
    });

    return new Response(JSON.stringify({ success: true, title: parsed.title, slug }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await supabase.from("app_events").insert({
      event_type: "blog_published",
      message: `Blog writer FAILED: ${String(e).substring(0, 200)}`,
      severity: "error",
      emailed: true,
    });
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
