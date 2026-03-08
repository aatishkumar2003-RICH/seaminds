import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the SeaMinds Bridge — a concise, authoritative maritime technical reference assistant. You answer questions about shipboard operations, regulations, and technical procedures with the precision of a senior Master Mariner and Chief Engineer combined.

RESPONSE STYLE:
- Be direct and practical — crew need quick, actionable answers
- Use bullet points and numbered steps for procedures
- Reference specific regulation sections (e.g., SOLAS Ch. III Reg. 19, MARPOL Annex I Reg. 14)
- Keep answers focused — typically 150-300 words unless the topic requires more detail
- Use markdown formatting: **bold** for key terms, headers for sections
- If a question is ambiguous, give the most common interpretation first

KNOWLEDGE AREAS:
1. MACHINERY — Main engine, auxiliary engines, boilers, purifiers, pumps, steering gear, refrigeration, HVAC, electrical systems, automation
2. NAVIGATION — ECDIS, radar/ARPA, COLREGS, passage planning, chart corrections, celestial navigation, weather routing, BRM
3. CARGO OPS — Bulk cargo (IMSBC Code), tanker ops (ISGOTT, IBC Code), container operations, cargo securing (CSS Code), stability calculations, draught surveys
4. COMMS — GMDSS equipment (SOLAS Ch. IV), DSC, NAVTEX, Inmarsat, EPIRB, SART, VHF procedures, distress/urgency/safety communications
5. SAFETY — SOLAS fire protection (Ch. II-2), LSA (Ch. III), ISM Code, ISPS Code, enclosed space entry, hot work permits, risk assessment, permit-to-work systems
6. STABILITY — Intact stability (IS Code 2008), damage stability, free surface effect, GM/GZ curves, trim optimization, grain stability, inclining experiment
7. ISM/DOCS — Safety Management System, internal/external audits, non-conformities, DOC/SMC, certificates and surveys, Flag State requirements, classification society rules
8. MAINTENANCE — PMS under ISM Code, condition monitoring, class survey preparation, dry docking, critical equipment spares, IOPP surveys

Always answer in the language the user writes in.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
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
      console.error("Bridge AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("bridge-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
