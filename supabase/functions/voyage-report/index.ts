import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { firstName, nationality, role, shipName, totalDays, moodBreakdown, totalCheckins, longestStreak } = await req.json();

    const moodSummary = Object.entries(moodBreakdown || {})
      .map(([mood, count]) => `${mood}: ${count} times`)
      .join(", ");

    const dominantMood = Object.entries(moodBreakdown || {})
      .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || "varied";

    const prompt = `You are SeaMinds, a compassionate mental wellness companion for seafarers. Generate a warm, personal voyage completion message for a crew member. Keep it 2-4 sentences. Be genuine, not generic.

Details:
- Name: ${firstName}
- Nationality: ${nationality || "unknown"}
- Role: ${role}
- Ship: ${shipName}
- Total days at sea this voyage: ${totalDays}
- Total check-ins on SeaMinds: ${totalCheckins}
- Longest streak of consecutive check-in days: ${longestStreak}
- Mood pattern: ${moodSummary || "no data"}
- Dominant mood: ${dominantMood}

Write a message that references their voyage length, nationality (if known), and overall mood pattern. Make it feel like a real person acknowledging their strength. Start with the number of days. Do not use quotation marks around the message.`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });

    const data = await resp.json();
    const message = data.choices?.[0]?.message?.content || "Your voyage is complete. Well done, sailor.";

    return new Response(JSON.stringify({ message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Voyage report error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
