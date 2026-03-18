import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert maritime HR officer who reads seafarer CVs and extracts structured data. Always return valid JSON with these exact fields: { "name": "", "rank": "", "nationality": "", "date_of_birth": "", "years_experience": "", "vessel_experience": [{"vessel_name": "", "vessel_type": "", "flag": "", "role": "", "from_date": "", "to_date": "", "engine_type": null, "cargo_type": null}], "certificates": [{"name": "", "number": "", "issued_by": "", "expiry_date": ""}], "main_engine_types": [], "cargo_experience": [], "education": [], "training_courses": [], "summary": "2-3 sentence professional summary", "personal": {"firstName": "", "lastName": "", "nationality": "", "rank": "", "yearsAtSea": "", "imoNumber": "", "currentVessel": "", "phone": ""}, "sea_service": [{"vessel_name": "", "vessel_type": "", "flag": "", "grt": "", "rank": "", "company": "", "sign_on": "", "sign_off": ""}], "medical": [{"cert_type": "", "issue_date": "", "expiry_date": "", "issuing_authority": ""}] }. If a field is not found, use null. Never return anything except valid JSON.`;

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

    let userContent: any[];

    if (isPdf) {
      userContent = [
        {
          type: "text",
          text: "This is a maritime seafarer CV in PDF format encoded as base64. Extract all information carefully including: full name, rank/position, nationality, date of birth, years of experience, all vessels worked on (name, type, flag, role, dates), all certificates (STCW, CoC, endorsements with numbers and expiry dates), main engine types for engineers, cargo experience for deck officers, education, training courses. Return as structured JSON."
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${mime_type};base64,${file_base64}`,
            detail: "high"
          }
        }
      ];
    } else {
      userContent = [
        {
          type: "text",
          text: "This is a maritime seafarer CV as an image. Extract all information carefully including: full name, rank/position, nationality, date of birth, years of experience, all vessels worked on (name, type, flag, role, dates), all certificates (STCW, CoC, endorsements with numbers and expiry dates), main engine types for engineers, cargo experience for deck officers, education, training courses. Return as structured JSON."
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${mime_type};base64,${file_base64}`,
            detail: "high"
          }
        }
      ];
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
      // Check if data is essentially empty
      const hasPersonal = parsed.personal && Object.values(parsed.personal || {}).some((v: any) => !!v);
      const hasName = !!parsed.name;
      const hasCerts = (parsed.certificates || []).length > 0;
      const hasVessels = (parsed.vessel_experience || []).length > 0;
      const hasSeaService = (parsed.sea_service || []).length > 0;

      if (!hasPersonal && !hasName && !hasCerts && !hasVessels && !hasSeaService) {
        console.error("AI returned empty data for all sections");
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
