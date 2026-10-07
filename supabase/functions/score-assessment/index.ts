import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authGate, aiPaused, meterAi } from "../_shared/aiGuard.ts";
import { callFinalAi, validateDims } from "../_shared/finalAi.ts";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-secret" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const { createClient } = await import('jsr:@supabase/supabase-js@2');
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  // ── Auth gate: worker secret OR real signed-in user ──
  const gate = await authGate(req, adminClient, cors);
  if (!gate.ok) return gate.response;

  // ── Rate limiting ──

  const rateLimitKey = gate.isWorker ? `score-assessment:worker` : `score-assessment:user:${gate.userId}`; // R3: per-candidate, not shared IP
  const windowMs = 10 * 60 * 1000;
  const maxAttempts = gate.isWorker ? 100000 : 30;
  const { data: rl } = await adminClient.from('auth_rate_limits').select('*').eq('ip_address', rateLimitKey).maybeSingle();
  const now = Date.now();
  if (rl) {
    const windowStart = new Date(rl.window_start).getTime();
    if (now - windowStart < windowMs && rl.attempt_count >= maxAttempts) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait before continuing.' }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (now - windowStart >= windowMs) {
      await adminClient.from('auth_rate_limits').update({ attempt_count: 1, window_start: new Date().toISOString(), last_attempt: new Date().toISOString() }).eq('ip_address', rateLimitKey);
    } else {
      await adminClient.from('auth_rate_limits').update({ attempt_count: rl.attempt_count + 1, last_attempt: new Date().toISOString() }).eq('ip_address', rateLimitKey);
    }
  } else {
    await adminClient.from('auth_rate_limits').insert({ ip_address: rateLimitKey, attempt_count: 1, window_start: new Date().toISOString(), last_attempt: new Date().toISOString() });
  }


  const J = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  let body: any = {};
  try { body = await req.json(); } catch { return J({ error_code: 'BAD_REQUEST' }, 400); }
  const assessmentId = typeof body?.assessmentId === 'string' ? body.assessmentId : '';
  if (!/^[0-9a-f-]{36}$/i.test(assessmentId)) return J({ error_code: 'BAD_REQUEST' }, 400);
  const caller = gate.isWorker ? null : gate.userId;

  // P0: server-authoritative context. Client rank/transcript/flags/weights/context are ignored.
  const { data: prep, error: prepErr } = await adminClient.rpc('finalize_assessment_prepare', { p_assessment_id: assessmentId, p_caller: caller });
  if (prepErr || !prep) return J({ error_code: 'PREPARE_FAILED' }, 503);
  const P: any = prep;
  if (P.already_completed) return J({ scores: { ...P.scores, certificate_id: P.certificate_id }, write_ok: true, already_completed: true });
  if (!P.ok) {
    const code = String(P.error_code || 'UNKNOWN');
    const status = code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 : (code === 'SCORING_PENDING' || code === 'SCORING_MANUAL_REVIEW') ? 409 : 422;
    return J({ error_code: code, ...(P.pending ? { pending: P.pending } : {}), ...(P.missing ? { missing: P.missing } : {}) }, status);
  }

  // Single-flight: one bounded lease per assessment; failures back off instead of re-calling the AI every poll.
  const { data: lease, error: leaseErr } = await adminClient.rpc('final_scoring_lease', { p_assessment_id: assessmentId, p_paper_id: P.paper_id, p_is_worker: !!gate.isWorker });
  const L: any = lease;
  if (leaseErr || !L) return J({ error_code: 'PREPARE_FAILED' }, 503);
  if (L.state === 'DEAD') return J({ error_code: 'FINALIZATION_MANUAL_REVIEW' }, 409);
  if (L.state === 'IN_PROGRESS') return J({ error_code: 'FINAL_SCORING_IN_PROGRESS', retry_after: L.retry_after }, 409);
  if (L.state === 'BACKOFF') return J({ error_code: 'FINAL_SCORING_RETRY', reason: 'backoff', retry_after: L.retry_after }, 503);
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const rank: string = P.rank;
  const firstName: string = P.first_name;
  const transcript: any[] = Array.isArray(P.transcript) ? P.transcript : [];
  const redFlags: any[] = Array.isArray(P.red_flags) ? P.red_flags : [];
  const candidateContext = { experience_tier: P.level || 'MID', ship_specialisation: P.vessel_context || 'GENERAL' };
  const retry = async (reason: string) => {
    try { await adminClient.from('app_events').insert({ event_type: 'final_scoring_retry', message: reason, severity: 'warning', metadata: { assessment_id: assessmentId } }); } catch (_) { /* observability only */ }
    try { await adminClient.rpc('final_scoring_release', { p_assessment_id: assessmentId, p_error: reason }); } catch (_) { /* lease expires anyway */ }
    return J({ error_code: 'FINAL_SCORING_RETRY', reason }, 503);
  };
  const storedDims = L.ai_result ? validateDims(L.ai_result) : null;
  if (!storedDims && await aiPaused(adminClient)) return retry('ai_paused');
  if (!storedDims && !OPENAI_API_KEY) return retry('ai_unconfigured');

  const hasTranscript = Array.isArray(transcript) && transcript.length > 0;

  // ── Level profile: weighted performance by question level ──
  const levelWeight = (t: any) => {
    const w = Number(t?.weight);
    if (isFinite(w) && w > 0) return w;
    const lvl = String(t?.level || "").toLowerCase();
    return lvl === "judgment" ? 1.5 : lvl === "application" ? 1.25 : 1.0;
  };
  const pctFor = (lvl: string) => {
    const items = (hasTranscript ? transcript : []).filter(
      (t: any) => String(t?.level || "recall").toLowerCase() === lvl
    );
    if (!items.length) return null;
    let got = 0, tot = 0;
    for (const t of items) {
      const w = levelWeight(t);
      got += w * Math.max(0, Math.min(10, Number(t?.score) || 0)) / 10;
      tot += w;
    }
    return tot > 0 ? Math.round((got / tot) * 100) : null;
  };
  const recall_pct = pctFor("recall");
  const application_pct = pctFor("application");
  const judgment_pct = pctFor("judgment");
  const verdict =
    (recall_pct ?? 0) >= 70 && (judgment_pct ?? 100) < 50
      ? "strong knowledge, unproven decision-making"
      : (judgment_pct ?? 0) >= 70 && (recall_pct ?? 100) < 50
      ? "sound judgment, weaker recall"
      : "balanced";
  const levelProfile = hasTranscript
    ? { recall_pct, application_pct, judgment_pct, questions: transcript.length, verdict }
    : null;

  // Weighted technical performance across the whole paper (0.00–5.00)
  let weightedTechnical: number | null = null;
  if (hasTranscript) {
    let got = 0, tot = 0;
    for (const t of transcript) {
      const w = levelWeight(t);
      got += w * Math.max(0, Math.min(10, Number(t?.score) || 0)) / 10;
      tot += w;
    }
    if (tot > 0) weightedTechnical = Math.round((got / tot) * 5 * 100) / 100;
  }
  const transcriptText = hasTranscript
    ? transcript.map((t: any, i: number) => `Q${i+1}: ${t.question}\nAnswer: ${t.answer}\nScore: ${t.score}/10${t.redFlag ? ' [RED FLAG: '+t.redFlagCategory+']' : ''}${t.followUp ? '\nFollow-up: '+t.followUp : ''}`).join('\n\n')
    : 'No transcript available.';
  const prompt = `You are a senior maritime superintendent scoring a seafarer interview.

Candidate: ${firstName}, ${rank}, ${candidateContext?.experience_tier || 'MID'} tier, ${candidateContext?.ship_specialisation || 'GENERAL'} vessel.

Full interview transcript (each answer was already scored 0-10 by the examiner):
${transcriptText}

Score FIVE dimensions on a scale of 0.00 to 5.00. NOT out of 10. NOT a percentage.

ANCHORS — use the full range:
5.00  Exceptional — exceeds what is expected of this rank
4.00  Strong — comfortably meets the rank standard
3.00  Adequate — meets the minimum, gaps present
2.00  Weak — below the standard for this rank
1.00  Poor — fundamental knowledge missing
0.00  No usable evidence in the transcript

DIMENSIONS:
- technical   : rank-specific knowledge (SOLAS, MARPOL, ISM, equipment, cargo). Weight the MCQ scores heavily.
- judgment    : scenario decisions, prioritisation under pressure, critical steps identified
- english     : clarity, structure and maritime terminology in the written answers
- behaviour   : professional behaviour — leadership, conflict handling, safety culture, accountability,
                willingness to challenge an unsafe instruction

DO NOT assess personal wellbeing, mental health, stress or fatigue. Those are private to the
seafarer and must never influence an employment score.

RULES:
- Judge against THIS RANK, not seafarers generally. A 3rd Officer is not judged as a Master.
- Two decimal places.
- Use the full range. If you give every dimension the same number, you are not assessing.
- Base every score on evidence in the transcript. Do not invent.

Return ONLY valid JSON, no markdown:
{ "technical": 0.00, "judgment": 0.00, "english": 0.00, "behaviour": 0.00 }`;

  let dims: any;
  if (storedDims) {
    dims = { ...storedDims }; // AI already answered for this exact paper; persistence is being retried — never regenerate.
    if (weightedTechnical !== null) dims.technical = weightedTechnical;
  } else {
    const _t0 = Date.now();
    const ai = await callFinalAi({ fetchImpl: fetch, apiKey: OPENAI_API_KEY!, prompt, timeoutMs: 30000, model: "gpt-4o", technicalOverride: weightedTechnical });
    await meterAi(adminClient, { userId: gate.userId, feature: "score-assessment", model: "gpt-4o", usage: (ai as any).usage ?? null, success: ai.ok, latencyMs: Date.now() - _t0 });
    if (!ai.ok) return retry(ai.reason);
    dims = ai.dims;
    const { data: saved } = await adminClient.rpc('final_scoring_save_ai', { p_assessment_id: assessmentId, p_paper_id: P.paper_id, p_dims: dims });
    if (saved !== true) console.warn('final AI result not cached; a retry would need a new AI call');
  }

  // Scoring v1.1 — wellness removed from employment scoring entirely.
  // Personal wellbeing is private to the seafarer and never influences hiring.
  const overall = Math.round((
    dims.technical * 0.30 +
    dims.judgment  * 0.30 +
    dims.english   * 0.25 +
    dims.behaviour * 0.15
  ) * 100) / 100;

  const band =
    overall >= 4.50 ? "ELITE" :
    overall >= 4.00 ? "STRONG" :
    overall >= 3.25 ? "COMPETENT" :
    overall >= 2.50 ? "DEVELOPING" : "NOT_READY";

  const recommendation =
    overall >= 4.00 ? "RECOMMENDED" :
    overall >= 3.25 ? "RECOMMENDED_WITH_NOTE" :
    overall >= 2.50 ? "DEVELOPMENT_NEEDED" : "NOT_RECOMMENDED_NOW";

  const scores = {
    technical: dims.technical,
    judgment: dims.judgment,
    english: dims.english,
    behaviour: dims.behaviour,
    overall,
    band,
    recommendation,
    scoring_version: "v1.1",
    level_profile: levelProfile,
  };

  // ── Canonical write: atomic, idempotent, row-locked commit (service role only) ──
  const abbrevMap: Record<string, string> = {
    "Master": "MA", "Chief Officer": "CO", "2nd Officer": "2O", "3rd Officer": "3O",
    "Chief Engineer": "CE", "Second Engineer": "2E", "3rd Engineer": "3E",
    "AB": "AB", "Bosun": "BO", "Cook": "CK", "Motorman": "MM", "Electrician": "EL",
  };
  // Unique per assessment (score/rank/year alone could collide); existing certificates keep their old IDs.
  const certCandidate = `SMC-${String(Math.round(overall * 100)).padStart(3, "0")}-${abbrevMap[rank] || "CR"}-${new Date().getFullYear()}-${assessmentId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const { data: cm, error: cmErr } = await adminClient.rpc('finalize_assessment_commit', {
    p_assessment_id: assessmentId, p_paper_id: P.paper_id, p_caller: caller,
    p_scores: scores, p_level_profile: levelProfile, p_red_flags: redFlags, p_certificate_id: certCandidate,
  });
  const C: any = cm;
  if (cmErr || !C?.ok) {
    console.error("score commit failed", cmErr?.message || C?.error_code);
    const terminal = ['STALE_PREPARE', 'PAPER_REQUIRED', 'FORBIDDEN', 'NOT_FOUND', 'CERTIFICATE_COLLISION'].includes(C?.error_code);
    try { await adminClient.rpc('final_scoring_release', { p_assessment_id: assessmentId, p_error: terminal ? null : 'persist_failed' }); } catch (_) { /* lease expires */ }
    return J({ error_code: terminal ? String(C.error_code) : 'PERSIST_FAILED', detail: C?.detail || C?.error_code || null }, terminal ? 409 : 503);
  }
  if (C.already_completed) return J({ scores: { ...C.scores, certificate_id: C.certificate_id }, write_ok: true, already_completed: true });
  const certificateId: string = C.certificate_id;
  try {
    const { data: arow } = await adminClient.from("smc_assessments").select("crew_profile_id, probed_claims").eq("id", assessmentId).maybeSingle();
    const crewId = (arow as any)?.crew_profile_id;
    const probedRaw = (arow as any)?.probed_claims;
    const probed: string[] = Array.isArray(probedRaw) ? probedRaw.map((k: any) => String(k)).filter(Boolean) : [];
    if (crewId && probed.length) {
      await adminClient.from("crew_claims").update({ status: "ASSESSED", assessed_at: new Date().toISOString() })
        .eq("crew_id", crewId).eq("status", "CLAIMED").in("claim_key", probed);
    }
  } catch (_e) { /* claim promotion never blocks scoring */ }

  return J({ scores: { ...scores, certificate_id: certificateId }, write_ok: true });
});
