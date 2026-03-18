import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a maritime HR expert. Extract ALL information from this seafarer CV and return ONLY valid JSON with no markdown:
{
  "name": "",
  "rank": "",
  "nationality": "",
  "date_of_birth": "",
  "years_experience": 0,
  "main_engine_types": [],
  "cargo_experience": [],
  "summary": "2-3 sentence professional summary",
  "certificates": [{"name":"","number":"","issue_date":"","expiry_date":"","issuing_authority":""}],
  "sea_service": [{"vessel_name":"","vessel_type":"","flag":"","rank":"","company":"","sign_on":"","sign_off":"","engine_type":"","cargo_type":""}],
  "education": [{"institution":"","qualification":"","year":""}]
}
Return ONLY the JSON object. No markdown. No explanation.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { file_base64, mime_type } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const isPdf = mime_type === "application/pdf";
    const isImage = mime_type?.startsWith("image/");
    if (!isPdf && !isImage) {
      return new Response(JSON.stringify({ error: "Please upload a PDF or image file." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const userContent: any[] = [
      { type: "text", text: "Extract all seafarer information from this CV. Return only the JSON object." }
    ];

    if (isPdf) {
      userContent.push({
        type: "file",
        file: { filename: "cv.pdf", file_data: `data:application/pdf;base64,${file_base64}` }
      });
    } else {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mime_type};base64,${file_base64}` }
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userContent }]
      })
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("OpenAI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI processing error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    try {
      const parsed = JSON.parse(jsonStr);
      return new Response(JSON.stringify({ success: true, data: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch {
      return new Response(JSON.stringify({ error: "Could not parse CV data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
