import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { aiPaused, aiPausedResponse, meterAi } from "../_shared/aiGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_RULES = `Each vacancy object: {rank_required, vessel_type, contract_duration, monthly_salary, joining_port, joining_date, contact_whatsapp, contact_email, additional_notes}. RULES: Never invent or guess any value — use null when the advert does not state it. Never invent contact details. If the advert lists multiple ranks, output ONE object PER RANK, repeating the shared vessel/port/contract details. 'Top 4' means Master, Chief Officer, Chief Engineer, 2nd Engineer. Keep rank names and vessel types in standard English maritime terms. RISK: flag 'high' if the advert asks seafarers for payment, placement fees or deposits; flag 'medium' if there is no company name, or only a personal email/phone with no company, or the salary is far outside normal maritime ranges. List the specific reasons in flags.`;

const SYSTEM_PROMPT = `You extract maritime job vacancies from informal recruitment adverts (WhatsApp/Telegram style). Return JSON: {"vacancies":[...],"risk":{"level":"low|medium|high","flags":[]}}. ${EXTRACTION_RULES}`;

const VISION_PROMPT = `STEP 1 — TRANSCRIBE: read EVERY piece of text visible in this recruitment flier, including headers, ranks, vessel details, dates, salaries, requirements, company name, licence numbers, phone numbers, emails and small print. Transcribe exactly what you can see, line by line. If some text is blurred or partly unreadable, transcribe your best reading and mark uncertain fragments with (?). STEP 2 — STRUCTURE: from that transcription, build the vacancies.

Return JSON only: {"raw_text":"<the full STEP 1 transcription>","vacancies":[...],"risk":{"level":"low|medium|high","flags":[]}}. ${EXTRACTION_RULES}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  const SB_URL = Deno.env.get("SUPABASE_URL")!;

  try {
    // --- auth: real signed-in user ---
    const authHeader = req.headers.get("Authorization") || "";
    let userId: string | null = null;
    if (authHeader.startsWith("Bearer ")) {
      const userClient = createClient(SB_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: u } = await userClient.auth.getUser();
      userId = u?.user?.id ?? null;
    }
    if (!userId) {
      return new Response(JSON.stringify({ ok: false, error: "auth_required" }), { status: 401, headers: jsonHeaders });
    }

    const admin = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    // --- approved manager only ---
    const { data: mgr } = await admin
      .from("manager_profiles")
      .select("admin_approved")
      .eq("user_id", userId)
      .maybeSingle();
    if (!mgr || mgr.admin_approved !== true) {
      return new Response(JSON.stringify({ ok: false, error: "not_approved" }), { status: 403, headers: jsonHeaders });
    }

    // --- kill switch ---
    if (await aiPaused(admin)) return aiPausedResponse(corsHeaders);

    // --- daily limit (30/day) ---
    try {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { count } = await admin
        .from("ai_usage")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("feature", "parse-vacancy-text")
        .gte("created_at", startOfDay.toISOString());
      if ((count ?? 0) >= 30) {
        return new Response(
          JSON.stringify({ ok: false, error: "daily_limit", message: "Daily limit reached — try again tomorrow." }),
          { status: 429, headers: jsonHeaders },
        );
      }
    } catch (_e) { /* never block on limit lookup failure */ }

    const body = await req.json().catch(() => ({}));
    const text = String(body?.text ?? "").slice(0, 8000).trim();
    if (!text) {
      return new Response(JSON.stringify({ ok: false, error: "empty_text" }), { status: 400, headers: jsonHeaders });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "ai_unavailable" }), { status: 500, headers: jsonHeaders });
    }

    const startedAt = Date.now();
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("parse-vacancy-text AI error:", res.status, t);
      await meterAi(admin, { userId, feature: "parse-vacancy-text", model: "gpt-4o-mini", usage: null, success: false, latencyMs: Date.now() - startedAt });
      return new Response(JSON.stringify({ ok: false, error: res.status === 429 ? "rate_limited" : "ai_error" }), {
        status: res.status === 429 ? 429 : 500, headers: jsonHeaders,
      });
    }

    const data = await res.json();
    await meterAi(admin, {
      userId, feature: "parse-vacancy-text", model: "gpt-4o-mini",
      usage: data?.usage ?? null, success: true, latencyMs: Date.now() - startedAt,
    });

    const raw = String(data?.choices?.[0]?.message?.content ?? "");
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: any = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      try { parsed = m ? JSON.parse(m[0]) : null; } catch { parsed = null; }
    }
    if (!parsed) {
      return new Response(JSON.stringify({ ok: false, error: "parse_failed" }), { status: 200, headers: jsonHeaders });
    }

    const vacancies = Array.isArray(parsed.vacancies) ? parsed.vacancies : [];
    const risk = parsed.risk && typeof parsed.risk === "object"
      ? { level: String(parsed.risk.level || "low"), flags: Array.isArray(parsed.risk.flags) ? parsed.risk.flags.map(String) : [] }
      : { level: "low", flags: [] };

    return new Response(JSON.stringify({ ok: true, vacancies, risk }), { status: 200, headers: jsonHeaders });
  } catch (e) {
    console.error("parse-vacancy-text error:", e);
    return new Response(JSON.stringify({ ok: false, error: "unexpected_error" }), { status: 200, headers: jsonHeaders });
  }
});
