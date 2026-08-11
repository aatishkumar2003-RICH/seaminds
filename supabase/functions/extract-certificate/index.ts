import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INSTRUCTION = `You read maritime certificates, licences, medicals, passports and seaman books. Return ONLY strict JSON: {"name": string (official document title), "certNumber": string, "issueDate": "YYYY-MM-DD" or "", "expiryDate": "YYYY-MM-DD" or ""}. If a field is unreadable, return empty string. No markdown, no explanation.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image, mimeType } = await req.json();
    if (!image) throw new Error("No image provided");

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const base64 = String(image).includes(",") ? String(image).split(",").pop() : String(image);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0,
        max_tokens: 400,
        messages: [
          { role: "system", content: INSTRUCTION },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the fields from this document." },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType || "image/jpeg"};base64,${base64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("OpenAI error:", res.status, t);
      return new Response(
        JSON.stringify({ error: "Could not read the image — please enter details manually." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();
    let raw: string = data?.choices?.[0]?.message?.content ?? "";
    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) raw = raw.slice(start, end + 1);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("Parse failure:", raw);
      return new Response(
        JSON.stringify({ error: "Could not read the image — please enter details manually." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        name: String(parsed.name ?? ""),
        certNumber: String(parsed.certNumber ?? ""),
        issueDate: String(parsed.issueDate ?? ""),
        expiryDate: String(parsed.expiryDate ?? ""),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("extract-certificate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
