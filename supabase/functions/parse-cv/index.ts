import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a maritime HR expert. Extract crew information from this CV document.
Return ONLY valid JSON with these exact fields (use empty string if not found):
{
  "firstName": "",
  "lastName": "",
  "email": "",
  "phone": "",
  "whatsapp": "",
  "nationality": "",
  "rank": "",
  "yearsAtSea": "",
  "vesselTypes": "",
  "certificates": "",
  "currentVessel": "",
  "imoNumber": "",
  "bio": ""
}
For rank use exactly one of: Captain, Chief Officer, 2nd Officer, 3rd Officer, Chief Engineer, 2nd Engineer, 3rd Engineer, 4th Engineer, ETO, Bosun, AB Seaman, OS, Oiler, Cook, Steward
For yearsAtSea use format: Less than 1 year, 1-3 years, 3-7 years, 7-15 years, 15+ years
Return ONLY the JSON object, no other text.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file_base64, mime_type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isPdf = mime_type === "application/pdf";
    const isImage = mime_type?.startsWith("image/");

    if (!isPdf && !isImage) {
      return new Response(JSON.stringify({ error: "Unsupported file type. Please upload a PDF or image." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent: any[] = [
      { type: "text", text: "Extract crew member information from this CV/resume document. Return only the JSON object." },
    ];

    if (isImage) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mime_type};base64,${file_base64}` },
      });
    } else {
      // PDF - send as document
      userContent.push({
        type: "image_url",
        image_url: { url: `data:application/pdf;base64,${file_base64}` },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    try {
      const parsed = JSON.parse(jsonStr);
      return new Response(JSON.stringify({ success: true, data: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      console.error("Failed to parse AI JSON:", content);
      return new Response(JSON.stringify({ error: "Could not parse CV data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("parse-cv error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
