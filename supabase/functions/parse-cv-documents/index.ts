import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a maritime document expert. Extract data and return ONLY valid JSON no markdown:
{"personal":{"firstName":"","lastName":"","nationality":"","rank":"","yearsAtSea":"","imoNumber":"","currentVessel":"","phone":""},"certificates":[{"name":"","number":"","issue_date":"","expiry_date":"","issuing_authority":"","place":""}],"sea_service":[{"vessel_name":"","vessel_type":"","flag":"","grt":"","rank":"","company":"","sign_on":"","sign_off":""}],"medical":[{"cert_type":"","issue_date":"","expiry_date":"","issuing_authority":""}],"education":[{"institution":"","qualification":"","year_from":"","year_to":""}]}
For "personal": extract the seafarer's first name, last name, nationality, rank/position, total years at sea (e.g. "5 years"), IMO number of their last/current vessel, current vessel name, and phone/WhatsApp number. Use empty strings if not found.
Return ONLY the JSON object, no other text, no markdown fences. Use empty arrays/strings if a section has no data.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file_base64, mime_type } = await req.json();
    console.log('parse-cv-documents called, mime_type:', mime_type, 'base64 length:', file_base64?.length);
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const isPdf = mime_type === "application/pdf";
    const isImage = mime_type?.startsWith("image/");

    if (!isPdf && !isImage) {
      return new Response(JSON.stringify({ error: "Unsupported file type. Please upload a PDF or image." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent: any[] = [
      { type: "text", text: "Extract all certificates, sea service records, medical certificates, and education from this maritime CV/resume document. Return only the JSON object." },
    ];

    if (isPdf) {
      userContent.push({
        type: "file",
        file: { filename: "cv.pdf", file_data: `data:application/pdf;base64,${file_base64}` },
      });
    } else {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mime_type};base64,${file_base64}` },
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
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
      console.error("OpenAI API error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI processing error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    try {
      const parsed = JSON.parse(jsonStr);
      const isEmpty = Object.values(parsed).every((v: any) => Array.isArray(v) && v.length === 0);
      if (isEmpty) {
        console.error("AI returned empty arrays for all sections");
        return new Response(JSON.stringify({ error: "AI could not read this file. Please try a clearer photo or text-based PDF." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, data: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      console.error("Failed to parse AI JSON:", content);
      return new Response(JSON.stringify({ error: "AI could not read this file. Please try a clearer photo or text-based PDF." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("parse-cv-documents error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});