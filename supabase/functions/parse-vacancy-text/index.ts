import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { aiPaused, aiPausedResponse, meterAi } from "../_shared/aiGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_RULES = `Each vacancy object: {rank_required, vessel_type, contract_duration, monthly_salary, joining_port, joining_date, contact_whatsapp, contact_email, additional_notes, positions}.

RULES:
1. ONE vacancy object PER RANK. If the advert lists Master, Chief Officer, 2/O, 3/O, Chief Engineer, 2/E, ETO you MUST return 7 objects. NEVER merge ranks into one object. Repeat the shared vessel / port / contract details on every object.
2. SALARY INTEGRITY: monthly_salary may contain ONLY the salary explicitly printed against that specific rank. If no salary is printed for that rank, monthly_salary = null. Never invent, average, combine or estimate a salary or salary range.
3. CONTACT INTEGRITY: read contact_email and contact_whatsapp EXACTLY as printed, including leading zeros and the "+" if present. Never invent contact details. Repeat the common contact details on EVERY rank object.
4. HEADCOUNT: "C/O x 2", "2 nos Chief Officer", "3 AB" → positions = 2, 2, 3. Otherwise positions = 1 (integer).
5. JOINING DATE: joining_date MUST be strict "YYYY-MM-DD" and ONLY when the source states an unambiguous calendar date (e.g. "Joining 2 September 2026" -> "2026-09-02"). Never output natural-language text in joining_date: "Immediate", "ASAP", "TBA", "urgent", "early September", "first week September" -> joining_date = null, and preserve that wording inside additional_notes instead. Never invent or guess a year or a date.
6. Use null (not empty strings or guesses) for anything the advert does not state. Keep rank names and vessel types in standard English maritime terms.
7. ranks_found: a top-level array listing every rank you saw in the source advert.
RISK: flag 'high' if the advert asks seafarers for payment, placement fees or deposits; flag 'medium' if there is no company name, or only a personal email/phone with no company, or the salary is far outside normal maritime ranges. List the specific reasons in flags.`;

const SYSTEM_PROMPT = `You extract maritime job vacancies from informal recruitment adverts (WhatsApp/Telegram style). Return JSON: {"vacancies":[...],"ranks_found":[],"risk":{"level":"low|medium|high","flags":[]}}. ${EXTRACTION_RULES}`;

const VISION_PROMPT = `STEP 1 — TRANSCRIBE: read EVERY piece of text visible in this recruitment flier, including headers, ranks, vessel details, dates, salaries, requirements, company name, licence numbers, phone numbers, emails and small print. Transcribe exactly what you can see, line by line. If some text is blurred or partly unreadable, transcribe your best reading and mark uncertain fragments with (?). STEP 2 — STRUCTURE: from that transcription, build the vacancies.

Return JSON only: {"raw_text":"<the full STEP 1 transcription>","vacancies":[...],"ranks_found":[],"risk":{"level":"low|medium|high","flags":[]}}. ${EXTRACTION_RULES}`;


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
    const rawImage = String(body?.image_base64 ?? "").trim();
    if (!text && !rawImage) {
      return new Response(JSON.stringify({ ok: false, error: "empty_text" }), { status: 400, headers: jsonHeaders });
    }
    if (rawImage && rawImage.length > 9_000_000) {
      return new Response(JSON.stringify({ ok: false, error: "image_too_large" }), { status: 400, headers: jsonHeaders });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "ai_unavailable" }), { status: 500, headers: jsonHeaders });
    }

    const isImage = rawImage.length > 0;
    const model = isImage ? "gpt-4o" : "gpt-4o-mini";
    const imageUrl = isImage
      ? (rawImage.startsWith("data:") ? rawImage : `data:image/jpeg;base64,${rawImage}`)
      : "";

    const messages = isImage
      ? [{
          role: "user",
          content: [
            { type: "text", text: VISION_PROMPT },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        }]
      : [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ];

    const startedAt = Date.now();

    const callAi = async (msgs: unknown[]) => {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 8000,
          response_format: { type: "json_object" },
          messages: msgs,
        }),
      });
      return r;
    };

    const parseJson = (raw: string): any => {
      const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      try { return JSON.parse(cleaned); } catch { /* fall through */ }
      const m = cleaned.match(/\{[\s\S]*\}/);
      try { return m ? JSON.parse(m[0]) : null; } catch { return null; }
    };

    const res = await callAi(messages);

    if (!res.ok) {
      const t = await res.text();
      console.error("parse-vacancy-text AI error:", res.status, t);
      await meterAi(admin, { userId, feature: "parse-vacancy-text", model, usage: null, success: false, latencyMs: Date.now() - startedAt });
      return new Response(JSON.stringify({ ok: false, error: res.status === 429 ? "rate_limited" : "ai_error" }), {
        status: res.status === 429 ? 429 : 500, headers: jsonHeaders,
      });
    }

    const data = await res.json();
    await meterAi(admin, {
      userId, feature: "parse-vacancy-text", model,
      usage: data?.usage ?? null, success: true, latencyMs: Date.now() - startedAt,
    });

    const parsed = parseJson(String(data?.choices?.[0]?.message?.content ?? ""));
    if (!parsed) {
      return new Response(JSON.stringify({ ok: false, error: "parse_failed" }), { status: 200, headers: jsonHeaders });
    }

    let vacancies: any[] = Array.isArray(parsed.vacancies) ? parsed.vacancies : [];
    const ranksFound: string[] = Array.isArray(parsed.ranks_found) ? parsed.ranks_found.map(String) : [];
    const raw_text = isImage ? String(parsed.raw_text ?? "").trim() : text;

    // ONE retry for missing ranks only — never a retry loop.
    if (ranksFound.length > vacancies.length) {
      const got = new Set(vacancies.map((v) => String(v?.rank_required ?? "").trim().toLowerCase()));
      const missing = ranksFound.filter((r) => !got.has(String(r).trim().toLowerCase()));
      const sourceText = raw_text || text;
      if (missing.length > 0 && sourceText) {
        try {
          const retryStart = Date.now();
          const retry = await callAi([
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `From the advert below, return ONLY vacancy objects for these missing ranks: ${missing.join(", ")}. Return JSON {"vacancies":[...],"ranks_found":[],"risk":{"level":"low","flags":[]}}.\n\n---\n${sourceText.slice(0, 12000)}`,
            },
          ]);
          if (retry.ok) {
            const rd = await retry.json();
            await meterAi(admin, {
              userId, feature: "parse-vacancy-text", model,
              usage: rd?.usage ?? null, success: true, latencyMs: Date.now() - retryStart,
            });
            const rp = parseJson(String(rd?.choices?.[0]?.message?.content ?? ""));
            const extra = Array.isArray(rp?.vacancies) ? rp.vacancies : [];
            for (const v of extra) {
              const key = String(v?.rank_required ?? "").trim().toLowerCase();
              if (key && !got.has(key)) { got.add(key); vacancies.push(v); }
            }
          }
        } catch (_e) { /* retry is best-effort */ }
      }
    }

    const isoDate = (x: unknown): string | null => {
      const v = String(x ?? "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
      const d = new Date(`${v}T00:00:00Z`);
      return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
    };

    vacancies = vacancies.map((v) => {
      const p = Number(v?.positions);
      const raw = String(v?.joining_date ?? "").trim();
      const safe = isoDate(raw);
      let notes = String(v?.additional_notes ?? "").trim();
      if (raw && !safe && !notes.toLowerCase().includes(raw.toLowerCase())) {
        notes = notes ? `${notes}\nJoining: ${raw}` : `Joining: ${raw}`;
      }
      return {
        ...v,
        joining_date: safe,
        additional_notes: notes || null,
        positions: Number.isFinite(p) && p >= 1 ? Math.floor(p) : 1,
      };
    });

    const risk = parsed.risk && typeof parsed.risk === "object"
      ? { level: String(parsed.risk.level || "low"), flags: Array.isArray(parsed.risk.flags) ? parsed.risk.flags.map(String) : [] }
      : { level: "low", flags: [] };

    return new Response(JSON.stringify({ ok: true, raw_text, vacancies, ranks_found: ranksFound, risk }), { status: 200, headers: jsonHeaders });
  } catch (e) {
    console.error("parse-vacancy-text error:", e);
    return new Response(JSON.stringify({ ok: false, error: "unexpected_error" }), { status: 200, headers: jsonHeaders });
  }
});
