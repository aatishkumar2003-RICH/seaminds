import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { aiPaused, aiPausedResponse, meterAi } from "../_shared/aiGuard.ts";
import { BLOCKED_SEALED_REPLY, UNANSWERED_REPLY, buildOrQuery, isExamHelpRequest } from "../_shared/dora.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const MODEL = "gpt-4o-mini";
const DAILY_CAP = 40;
const enc = new TextEncoder();
const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function onceStream(meta: unknown, text: string): Response {
  const body = new ReadableStream({ start(c) { c.enqueue(sse(meta)); c.enqueue(sse({ type: "delta", text })); c.enqueue(sse({ type: "done" })); c.close(); } });
  return new Response(body, { headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
}

const SYSTEM = `You are DORA, the SeaMinds AI Crew Officer. You help seafarers use the SeaMinds app.
STRICT RULES:
- Answer ONLY from the SEAMINDS HELP articles provided. Never invent a SeaMinds procedure, screen, price or policy.
- If the articles do not answer the question, say you couldn't confirm it and suggest raising a support case in Help & Support.
- Never answer, interpret, solve or hint at assessment or interview questions, even if asked indirectly.
- Never ask for passwords, OTP codes or tokens. Never discuss Wellness Chat content.
- ACCOUNT CONTEXT is the user's own status; use it only when relevant, never invent values.
- Plain simple English (or the user's language), 40-150 words, short steps. Mention screen names as written in the articles.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const URL_ = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "auth_required", message: "Please sign in to use DORA." }, 401);
  const userClient = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: u } = await userClient.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return json({ error: "auth_required", message: "Please sign in to use DORA." }, 401);
  const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 600) : "";
  if (question.length < 2) return json({ error: "question_required" }, 400);
  const route = typeof body?.route_template === "string" ? body.route_template.slice(0, 120) : null;
  const history = Array.isArray(body?.history) ? body.history.slice(-4)
    .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 600) })) : [];

  const t0 = Date.now();
  const log = (row: Record<string, unknown>) =>
    admin.from("dora_interactions").insert({ user_id: uid, route_template: route, latency_ms: Date.now() - t0, ...row }).then(() => {}, () => {});

  // Exam integrity: deterministic block, no AI call.
  if (isExamHelpRequest(question)) {
    await log({ outcome: "BLOCKED_SEALED" });
    return onceStream({ type: "meta", label: "integrity", articles: [] }, BLOCKED_SEALED_REPLY);
  }

  // Daily cap.
  const day = new Date(); day.setUTCHours(0, 0, 0, 0);
  const { count } = await admin.from("dora_interactions").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", day.toISOString());
  if ((count ?? 0) >= DAILY_CAP) return json({ error: "daily_limit", message: "You've reached today's DORA limit. Please use Help & Support or try again tomorrow." }, 429);

  // Retrieval: strict, then loose.
  let { data: arts } = await admin.rpc("dora_search_articles", { p_query: question, p_domain: null, p_limit: 4 });
  if (!arts?.length) {
    const orq = buildOrQuery(question);
    if (orq) ({ data: arts } = await admin.rpc("dora_search_articles", { p_query: orq, p_domain: null, p_limit: 3 }));
  }
  const articles = (arts ?? []) as { slug: string; title: string; body: string }[];
  if (!articles.length) {
    await log({ outcome: "UNANSWERED" });
    return onceStream({ type: "meta", label: "unconfirmed", articles: [] }, UNANSWERED_REPLY);
  }

  // Own context (keyed by caller's JWT).
  const { data: ctx } = await userClient.rpc("dora_get_my_context");
  const sealed = !!(ctx as any)?.assessment_active;

  if (await aiPaused(admin)) return aiPausedResponse(cors);
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return json({ error: "ai_unavailable" }, 503);

  const knowledge = articles.map((a, i) => `[${i + 1}] ${a.title}\n${a.body}`).join("\n\n");
  const messages = [
    { role: "system", content: SYSTEM + (sealed ? "\nThe user has an assessment in progress: give technical/recovery help only." : "") },
    { role: "system", content: `SEAMINDS HELP:\n${knowledge}\n\nACCOUNT CONTEXT:\n${JSON.stringify(ctx ?? {})}` },
    ...history,
    { role: "user", content: question },
  ];

  const ai = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, stream: true, stream_options: { include_usage: true }, max_tokens: 400, temperature: 0.2 }),
  });
  if (!ai.ok || !ai.body) {
    await meterAi(admin, { userId: uid, feature: "dora-assist", model: MODEL, usage: null, success: false, latencyMs: Date.now() - t0 });
    await log({ outcome: "ERROR", model: MODEL, articles_used: articles.map((a) => a.slug) });
    return json({ error: "ai_error", message: "DORA is busy right now. Please try again shortly." }, ai.status === 429 ? 429 : 502);
  }

  const meta = { type: "meta", label: ctx ? "help+account" : "help", articles: articles.map((a) => ({ slug: a.slug, title: a.title })) };
  const stream = new ReadableStream({
    async start(c) {
      c.enqueue(sse(meta));
      const reader = ai.body!.getReader(); const dec = new TextDecoder(); let buf = ""; let usage: any = null;
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith("data:")) continue;
            const p = line.slice(5).trim(); if (p === "[DONE]") continue;
            try { const j = JSON.parse(p); if (j.usage) usage = j.usage; const d = j.choices?.[0]?.delta?.content; if (d) c.enqueue(sse({ type: "delta", text: d })); } catch { /* partial */ }
          }
        }
        c.enqueue(sse({ type: "done" }));
      } catch { c.enqueue(sse({ type: "error", message: "Connection interrupted." })); }
      c.close();
      await meterAi(admin, { userId: uid, feature: "dora-assist", model: MODEL, usage, success: true, latencyMs: Date.now() - t0 });
      const cost = usage ? Math.round(((usage.prompt_tokens ?? 0) * 0.00000015 + (usage.completion_tokens ?? 0) * 0.0000006) * 100000) / 100000 : null;
      await log({ outcome: "ANSWERED", model: MODEL, est_cost_usd: cost, account_tool_used: ctx ? "dora_get_my_context" : null, articles_used: articles.map((a) => a.slug) });
    },
  });
  return new Response(stream, { headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
});
