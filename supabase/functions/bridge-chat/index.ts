import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { aiPaused, aiPausedResponse, meterAi } from "../_shared/aiGuard.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SB_URL = Deno.env.get("SUPABASE_URL")!;
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  // --- auth gate: a real signed-in user is required ---
  const authHeader = req.headers.get("Authorization") || "";
  let authedUserId: string | null = null;
  if (authHeader.startsWith("Bearer ")) {
    const userClient = createClient(SB_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: u } = await userClient.auth.getUser();
    authedUserId = u?.user?.id ?? null;
  }
  if (!authedUserId) {
    return new Response(JSON.stringify({ error: "auth_required", message: "Please sign in to continue." }), {
      status: 401, headers: jsonHeaders,
    });
  }

  const adminClient = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // --- kill switch ---
  if (await aiPaused(adminClient)) return aiPausedResponse(corsHeaders);

  // --- daily rate limit (100/day) ---
  try {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count } = await adminClient
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authedUserId)
      .eq("feature", "bridge-chat")
      .gte("created_at", startOfDay.toISOString());
    if ((count ?? 0) >= 100) {
      return new Response(
        JSON.stringify({
          error: "daily_limit",
          message: "You've reached today's Bridge question limit. Resets at midnight UTC ⚓",
        }),
        { status: 429, headers: jsonHeaders },
      );
    }
  } catch (_e) { /* never block on limit lookup failure */ }

  const startedAt = Date.now();

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
      await meterAi(adminClient, { userId: authedUserId, feature: "bridge-chat", model: "gpt-4o-mini", usage: null, success: false, latencyMs: Date.now() - startedAt });
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await meterAi(adminClient, { userId: authedUserId, feature: "bridge-chat", model: "gpt-4o-mini", usage: null, success: true, latencyMs: Date.now() - startedAt });

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
