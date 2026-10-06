// R3: async, retryable scoring for non-MCQ issued-paper answers.
// Answers are already durable in answer_ledger; a technical failure never becomes a score.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { authGate } from "../_shared/aiGuard.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-secret" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const URL_ = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const gate = await authGate(req, admin, cors);
  if (!gate.ok) return gate.response;

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const assessmentId = typeof body.assessmentId === "string" ? body.assessmentId : null;

  // Candidates may only kick jobs for their own assessment; worker/cron may drain all.
  if (!gate.isWorker) {
    if (!assessmentId) return json({ error: "assessmentId required" }, 400);
    const { data: a } = await admin.from("smc_assessments").select("crew_profile_id").eq("id", assessmentId).maybeSingle();
    if (!a || (a as any).crew_profile_id !== gate.userId) return json({ error: "Forbidden" }, 403);
    const { data: okRate } = await admin.rpc("candidate_rate_ok", { p_candidate: gate.userId, p_scope: assessmentId, p_action: "kick_scoring", p_max: 60, p_window: "10 minutes" });
    if (okRate === false) return json({ error_code: "RATE_LIMITED" }, 429);
  }

  const { data: secretRow } = await admin.from("admin_settings").select("value").eq("key", "scoring_worker_secret").maybeSingle();
  const secret = (secretRow as any)?.value || "";
  const { data: simRow } = await admin.from("admin_settings").select("value").eq("key", "r3_simulate_scoring_failure").maybeSingle();
  const simulateFor = ((simRow as any)?.value || "").toString();

  const { data: jobs, error: claimErr } = await admin.rpc("claim_answer_scoring_jobs", { p_assessment_id: assessmentId, p_limit: 5 });
  if (claimErr) return json({ error: "claim_failed" }, 500);

  const out: any[] = [];
  for (const job of (jobs as any[]) || []) {
    const { data: led } = await admin.from("answer_ledger").select("*").eq("id", job.ledger_id).maybeSingle();
    if (!led || (led as any).scoring_state === "EVALUATED") {
      await admin.from("answer_scoring_jobs").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", job.id);
      continue;
    }
    const L: any = led;
    const [{ data: paper }, { data: key }, { data: asmt }] = await Promise.all([
      admin.from("issued_papers").select("items, context, is_test").eq("id", L.paper_id).maybeSingle(),
      admin.from("issued_paper_keys").select("answer_key").eq("paper_id", L.paper_id).eq("paper_item_id", L.paper_item_id).maybeSingle(),
      admin.from("smc_assessments").select("interview_mode").eq("id", L.assessment_id).maybeSingle(),
    ]);
    const item = ((paper as any)?.items || []).find((i: any) => i.paper_item_id === L.paper_item_id) || {};
    const k: any = (key as any)?.answer_key || {};
    const ctx: any = (paper as any)?.context || {};
    let failure: string | null = null;
    let result: any = null;
    const model = "gpt-4o-mini";

    if ((paper as any)?.is_test && simulateFor && simulateFor === L.assessment_id) {
      failure = "SIMULATED_TIMEOUT (test paper only)";
    } else {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 30000);
        const r = await fetch(`${URL_}/functions/v1/evaluate-answer`, {
          method: "POST", signal: ctl.signal,
          headers: { "Content-Type": "application/json", "x-worker-secret": secret, apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" },
          body: JSON.stringify({
            question: [item.situation, item.question].filter(Boolean).join("\n"),
            answer: L.answer, question_type: L.item_type === "scenario" ? "scenario" : "behavioural",
            key_steps: k.key_steps, critical_step: k.critical_step, rank: ctx.canonical_rank, experience_tier: "MID",
            department: ctx.department_code, mode: (asmt as any)?.interview_mode === "company" ? "company" : undefined,
            assessmentId: L.assessment_id, strict_failures: true,
          }),
        });
        clearTimeout(t);
        const j = await r.json().catch(() => null);
        if (!r.ok || !j || typeof j.score !== "number") failure = `HTTP_${r.status}${j?.error ? ":" + String(j.error).slice(0, 60) : ""}`;
        else result = j;
      } catch (e) {
        failure = (e as Error)?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR";
      }
    }

    const now = new Date().toISOString();
    if (result) {
      const score = Math.max(0, Math.min(10, Number(result.score)));
      await admin.from("answer_ledger").update({
        scoring_state: "EVALUATED", score, evaluated_at: now, scoring_attempts: job.attempts, last_scoring_error: null,
        result: { strength_level: result.strength_level, red_flag: !!result.red_flag, red_flag_category: result.red_flag_category ?? null, red_flag_evidence: result.red_flag_evidence ?? null, method: "ai", model },
      }).eq("id", L.id).neq("scoring_state", "EVALUATED");
      await admin.from("answer_scoring_jobs").update({ status: "done", last_error: null, updated_at: now }).eq("id", job.id);
      await admin.from("answer_scoring_audit").insert({ ledger_id: L.id, job_id: job.id, attempt: job.attempts, outcome: "EVALUATED", model });
      out.push({ ledger_id: L.id, state: "EVALUATED" });
    } else {
      const dead = job.attempts >= job.max_attempts;
      await admin.from("answer_ledger").update({ scoring_state: "RETRY_REQUIRED", scoring_attempts: job.attempts, last_scoring_error: failure }).eq("id", L.id).neq("scoring_state", "EVALUATED");
      await admin.from("answer_scoring_jobs").update({ status: dead ? "dead" : "pending", last_error: failure, updated_at: now }).eq("id", job.id);
      await admin.from("answer_scoring_audit").insert({ ledger_id: L.id, job_id: job.id, attempt: job.attempts, outcome: dead ? "DEAD_LETTER" : "RETRY_SCHEDULED", reason: failure, model });
      if (dead) await admin.from("app_events").insert({ event_type: "answer_scoring_dead_letter", message: "Answer scoring exhausted retries — manual review", severity: "error", metadata: { ledger_id: L.id, job_id: job.id, assessment_id: L.assessment_id, reason: failure } });
      out.push({ ledger_id: L.id, state: "RETRY_REQUIRED", reason: failure });
    }
  }
  return json({ processed: out.length, results: out });
});
