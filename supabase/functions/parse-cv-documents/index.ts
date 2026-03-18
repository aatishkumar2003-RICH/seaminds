import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a maritime HR expert. Extract ALL information from this seafarer CV document and return ONLY valid JSON with no markdown fences, no explanation:
{
  "name": "Full name as written",
  "rank": "Current or most recent rank/position",
  "nationality": "Nationality",
  "date_of_birth": "DD/MM/YYYY or YYYY-MM-DD",
  "passport_no": "Passport number",
  "cdc_no": "Seaman book / CDC number",
  "cdc_country": "Country that issued CDC",
  "phone": "Phone or WhatsApp number",
  "email": "Email address",
  "summary": "2-3 sentence professional summary based on experience",
  "main_engine_types": ["engine type 1", "engine type 2"],
  "cargo_experience": ["cargo type 1", "cargo type 2"],
  "sea_service": [
    {
      "vessel_name": "",
      "vessel_type": "Bulk Carrier/Tanker/Container/LNG/LPG/RORO/Offshore/General Cargo/Passenger/Chemical",
      "flag": "",
      "grt": "",
      "rank": "rank on this vessel",
      "company": "shipping company name",
      "sign_on": "DD/MM/YYYY",
      "sign_off": "DD/MM/YYYY",
      "engine_type": "main engine type if engineer",
      "cargo_type": "cargo type if deck officer"
    }
  ],
  "certificates": [
    {
      "name": "Certificate name",
      "number": "Certificate number",
      "issue_date": "DD/MM/YYYY",
      "expiry_date": "DD/MM/YYYY",
      "issuing_authority": "Authority or flag state"
    }
  ],
  "medical": [
    {
      "cert_type": "ENG1/PEME/etc",
      "issue_date": "DD/MM/YYYY",
      "expiry_date": "DD/MM/YYYY",
      "issuing_authority": ""
    }
  ],
  "education": [
    {
      "institution": "",
      "qualification": "",
      "year": ""
    }
  ]
}
Use empty string "" for any field not found. Use empty array [] for any array not found. Return ONLY the JSON object. No markdown. No preamble.`;

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
