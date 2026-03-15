import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { rank, firstName, lastName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are scoring a maritime crew competency assessment. Score honestly based on rank: senior officers score higher baseline, junior ratings score lower. Add random variation of ±0.3 to make each certificate unique. Return ONLY a JSON object with these exact keys: technical, experience, communication, behavioural, wellness — each a number between 2.5 and 5.0 with 2 decimal places. No other text.",
          },
          {
            role: "user",
            content: `Score this seafarer: Rank=${rank}, Name=${firstName} ${lastName}. Generate realistic scores.`,
          },
        ],
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI scoring failed");
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    // Strip markdown code fences if present
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const scores = JSON.parse(content);

    return new Response(JSON.stringify({ scores }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("score-assessment error:", e);
    // Fallback scores
    const fallback = {
      technical: +(3.85 + Math.random() * 0.8).toFixed(2),
      experience: +(3.70 + Math.random() * 0.9).toFixed(2),
      communication: +(3.60 + Math.random() * 0.7).toFixed(2),
      behavioural: +(3.75 + Math.random() * 0.6).toFixed(2),
      wellness: +(3.80 + Math.random() * 0.5).toFixed(2),
    };
    return new Response(JSON.stringify({ scores: fallback, fallback: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
