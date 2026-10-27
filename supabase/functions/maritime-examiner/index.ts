// Phase 2 — adaptive maritime examiner. Stateless turn engine: client sends transcript,
// server returns assessment of the latest answer + next adaptive question. Persistence,
// verdict storage and manager reports arrive in Phase 4 (server-side, not client-trusted).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { authGate, aiPaused, aiPausedResponse, meterAi } from "../_shared/aiGuard.ts";
import { validateInput, buildExamMessages, finalizeStep, summarise, MAX_TURNS, type Turn } from "../_shared/maritimeExaminer.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const MODEL = "gpt-4o-mini";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const gate = await authGate(req, admin, cors);
  if (!gate.ok) return gate.response;
  if (await aiPaused(admin)) return aiPausedResponse(cors);

  // Rate limit: 40 turns / 10 min per user (≈5 sessions).
  const key = `maritime-examiner:user:${gate.userId}`;
  const now = Date.now();
  const { data: rl } = await admin.from("auth_rate_limits").select("*").eq("ip_address", key).maybeSingle();
  if (rl && now - new Date(rl.window_start).getTime() < 600_000) {
    if (rl.attempt_count >= 40) return json({ error: "rate_limited", message: "Please wait a few minutes before continuing." }, 429);
    await admin.from("auth_rate_limits").update({ attempt_count: rl.attempt_count + 1, last_attempt: new Date().toISOString() }).eq("ip_address", key);
  } else if (rl) {
    await admin.from("auth_rate_limits").update({ attempt_count: 1, window_start: new Date().toISOString(), last_attempt: new Date().toISOString() }).eq("ip_address", key);
  } else {
    await admin.from("auth_rate_limits").insert({ ip_address: key, attempt_count: 1, window_start: new Date().toISOString(), last_attempt: new Date().toISOString() });
  }

  let raw: any;
  try { raw = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  // Phase 4: the transcript is server-owned. Existing sessions ignore client-sent turns/questions.
  const sessionId = typeof raw?.sessionId === "string" ? raw.sessionId : null;
  let session: any = null;
  if (sessionId) {
    const { data } = await admin.from("maritime_interview_sessions").select("*").eq("id", sessionId).eq("crew_id", gate.userId).maybeSingle();
    if (!data) return json({ error: "session_not_found", message: "This interview session was not found." }, 404);
    if (data.status !== "in_progress") return json({ error: "session_closed", message: "This interview has already ended." }, 409);
    session = data;
    raw = { rank: data.rank, targetRank: data.target_rank, vessel: data.vessel, language: data.language, turns: data.turns, answer: raw?.answer };
  } else {
    raw = { ...raw, turns: [], answer: undefined };
  }
  const v = validateInput(raw);
  if (!v.ok) return json({ error: v.error }, 400);
  if (session) v.value.turns = (session.turns as Turn[]).slice(0, MAX_TURNS);
  const pending: string | null = session?.pending_question ?? null;
  if (session && (!pending || !v.value.answer)) return json({ error: "answer_required", message: "Please type an answer first." }, 400);

  const { messages, turnIndex } = buildExamMessages(v.value, pending);
  const started = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.5, max_tokens: 500, response_format: { type: "json_object" } }),
  });
  if (!res.ok) {
    await meterAi(admin, { userId: gate.userId, feature: "maritime-examiner", model: MODEL, success: false, latencyMs: Date.now() - started });
    const status = res.status === 429 ? 429 : 502;
    return json({ error: "ai_unavailable", message: "The examiner is busy. Please try again shortly." }, status);
  }
  const data = await res.json();
  await meterAi(admin, { userId: gate.userId, feature: "maritime-examiner", model: MODEL, usage: data.usage, success: true, latencyMs: Date.now() - started });
  let parsed: unknown = {};
  try { parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}"); } catch { /* handled by finalizeStep */ }
  const step = finalizeStep(parsed, pending ? (v.value.answer ?? "") : undefined, turnIndex);
  const nowIso = new Date().toISOString();
  if (!session) {
    if (step.done || !step.next_question) return json(step);
    const { data: created, error } = await admin.from("maritime_interview_sessions").insert({
      crew_id: gate.userId, rank: v.value.rank, target_rank: v.value.targetRank ?? null, vessel: v.value.vessel ?? null,
      language: v.value.language ?? null, pending_question: step.next_question,
    }).select("id").single();
    if (error) return json({ error: "save_failed", message: "Could not start a saved session. Please try again." }, 500);
    return json({ ...step, sessionId: created.id });
  }
  const turns: Turn[] = [...v.value.turns, { question: pending!, answer: v.value.answer!, ...(step.assessment ?? {}) } as Turn];
  const done = step.done || turns.length >= MAX_TURNS;
  const patch: Record<string, unknown> = { turns, updated_at: nowIso, pending_question: done ? null : step.next_question };
  if (done) {
    const sum = summarise(turns);
    Object.assign(patch, { status: "completed", completed_at: nowIso, technical_pct: sum.technical_pct, safety_flags: sum.safety_flags, gaps: sum.gaps, verdict: sum.verdict });
  }
  // Optimistic guard: only advance if nobody else advanced this session meanwhile.
  const { data: upd } = await admin.from("maritime_interview_sessions").update(patch)
    .eq("id", session.id).eq("status", "in_progress").eq("updated_at", session.updated_at).select("id");
  if (!upd?.length) return json({ error: "session_conflict", message: "This answer was already submitted. Please refresh." }, 409);
  return json({ ...step, done, next_question: done ? null : step.next_question, sessionId: session.id });
});
