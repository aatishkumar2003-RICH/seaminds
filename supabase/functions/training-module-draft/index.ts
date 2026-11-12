import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { aiPaused, aiPausedResponse, meterAi } from "../_shared/aiGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const J = { ...corsHeaders, "Content-Type": "application/json" };
const out = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: J });

/** Manager-only: drafts a short crew briefing (objectives, key points, self-check questions) for a custom training topic. Nothing stored. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const SB_URL = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return out({ ok: false, error: "auth_required" }, 401);
  const uc = createClient(SB_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u } = await uc.auth.getUser();
  const userId = u?.user?.id;
  if (!userId) return out({ ok: false, error: "auth_required" }, 401);
  const admin = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: mgr } = await admin.from("manager_profiles").select("id").eq("user_id", userId).maybeSingle();
  if (!mgr) return out({ ok: false, error: "managers_only" }, 403);
  if (await aiPaused(admin)) return aiPausedResponse(corsHeaders);
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("feature", "training-module-draft").gte("created_at", since);
  if ((count ?? 0) >= 30) return out({ ok: false, error: "Too many drafts this hour — try again later." }, 429);

  const body = await req.json().catch(() => ({}));
  const topic = String(body?.topic ?? "").trim().slice(0, 300);
  const rank = String(body?.rank ?? "").trim().slice(0, 60);
  const category = String(body?.category ?? "").trim().slice(0, 60);
  if (topic.length < 3) return out({ ok: false, error: "Enter a training topic." }, 400);
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return out({ ok: false, error: "AI is not configured." }, 500);

  const started = Date.now();
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini", temperature: 0.3, max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a senior marine superintendent writing a short pre-joining briefing for seafarers. Use only widely accepted facts (STCW, SOLAS, MARPOL, MLC, COLREG, ISM, SMCP, OCIMF/ICS guidance). Never invent company procedures, figures or regulation numbers you are unsure of. Reply as JSON: {\"title\": string (max 70 chars), \"objectives\": string[3-4], \"key_points\": string[5-7] (each max 160 chars), \"self_check\": string[3] (questions the crew should be able to answer)}." },
        { role: "user", content: `Category: ${category || "General"}\nTarget rank: ${rank || "Any rank"}\nTopic: ${topic}` },
      ],
    }),
  });
  const j = await r.json().catch(() => null);
  await meterAi(admin, { userId, feature: "training-module-draft", model: "gpt-4o-mini", usage: j?.usage, success: r.ok, latencyMs: Date.now() - started });
  if (!r.ok) return out({ ok: false, error: r.status === 429 ? "AI is busy — try again in a minute." : "Could not draft this module." }, r.status === 429 ? 429 : 502);
  try {
    const d = JSON.parse(j.choices[0].message.content);
    const arr = (v: unknown, n: number) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, n) : []);
    return out({ ok: true, draft: { title: String(d.title || topic).slice(0, 80), objectives: arr(d.objectives, 4), key_points: arr(d.key_points, 7), self_check: arr(d.self_check, 3) } });
  } catch { return out({ ok: false, error: "Could not draft this module." }, 502); }
});
