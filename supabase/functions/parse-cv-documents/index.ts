import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SYSTEM_PROMPT = `You are a maritime HR expert. Extract ALL information from this seafarer CV document and return ONLY valid JSON with no markdown fences, no explanation:
{
  "name": "Full name as written",
  "first_name": "Given name(s) incl. middle name",
  "last_name": "Surname / family name",
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
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!jwt || !url || !anonKey) return new Response(JSON.stringify({ error: "Please sign in before uploading your CV." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: auth, error: authError } = await createClient(url, anonKey).auth.getUser(jwt);
    if (authError || !auth.user) return new Response(JSON.stringify({ error: "Please sign in before uploading your CV." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const body = await req.json().catch(() => null);
    const { file_base64, mime_type, text_content } = body || {};
    const isSheet = mime_type === "text/spreadsheet";
    if (isSheet) {
      if (typeof text_content !== "string" || !text_content.trim() || text_content.length > 60000) {
        return new Response(JSON.stringify({ error: "The spreadsheet had no readable content." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else if (typeof file_base64 !== "string" || !file_base64.length || file_base64.length > 28 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(file_base64) || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mime_type)) {
      return new Response(JSON.stringify({ error: "Choose a non-empty PDF, JPG, PNG, WebP or Excel (.xlsx) file up to 20 MB." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const isPdf = mime_type === "application/pdf";
    const userContent: any[] = [
      { type: "text", text: "Extract all seafarer information from this CV. Return only the JSON object." }
    ];

    if (isSheet) {
      userContent.push({ type: "text", text: "This CV comes from an Excel agency application form. Cells are separated by ' | ', one row per line, grouped by sheet. Map labels (e.g. 'Seaman Book', 'CoC', 'GRT', 'Sign on') to the schema. Expand abbreviations: CE=Chief Engineer, C/O=Chief Officer, 2/E=2nd Engineer, B.C/BC=Bulk Carrier, CONT=Container. Phone numbers starting 00 become +. Whole numbers between 20000 and 60000 in date columns are Excel serial dates (days since 1899-12-30) — convert them to DD/MM/YYYY. When name parts are labelled (SURNAME)/(FIRST NAME)/(MIDDLE NAME), set last_name = surname and first_name = first + middle. Labels may sit on the row BELOW the values; match them by position (1st value = 1st label). Pre-interview answers (engine makers, wages) go into summary/main_engine_types.\n\n" + text_content });
    } else if (isPdf) {
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
