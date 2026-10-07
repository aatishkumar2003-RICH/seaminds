import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authGate, aiPaused, aiPausedResponse, meterAi } from "../_shared/aiGuard.ts";
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

  if (await aiPaused(adminClient)) return aiPausedResponse(cors);
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const rank: string = P.rank;
  const firstName: string = P.first_name;
  const transcript: any[] = Array.isArray(P.transcript) ? P.transcript : [];
  const redFlags: any[] = Array.isArray(P.red_flags) ? P.red_flags : [];
  const candidateContext = { experience_tier: P.level || 'MID', ship_specialisation: P.vessel_context || 'GENERAL' };
  const retry = async (reason: string) => {
    try { await adminClient.from('app_events').insert({ event_type: 'final_scoring_retry', message: reason, severity: 'warning', metadata: { assessment_id: assessmentId } }); } catch (_) { /* observability only */ }
    return J({ error_code: 'FINAL_SCORING_RETRY', reason }, 503);
  };
  if (!OPENAI_API_KEY) return retry('ai_unconfigured');

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

  const _t0 = Date.now();
  let data: any = null; let resOk = false;
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 30000);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 300, temperature: 0.2 }),
    });
    clearTimeout(tm);
    resOk = res.ok;
    data = await res.json().catch(() => null);
  } catch (e) {
    await meterAi(adminClient, { userId: gate.userId, feature: "score-assessment", model: "gpt-4o", usage: null, success: false, latencyMs: Date.now() - _t0 });
    return retry((e as any)?.name === 'AbortError' ? 'ai_timeout' : 'ai_network');
  }
  await meterAi(adminClient, { userId: gate.userId, feature: "score-assessment", model: "gpt-4o", usage: data?.usage, success: resOk, latencyMs: Date.now() - _t0 });
  if (!resOk) return retry('ai_http_error');

  const text = String(data?.choices?.[0]?.message?.content || "").replace(/```json|```/g, "").trim();
  const strict = (n: any) => (typeof n === 'number' && isFinite(n) && n >= 0 && n <= 5) ? Math.round(n * 100) / 100 : null;
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { return retry('ai_malformed_json'); }
  const dims: any = { technical: strict(parsed?.technical), judgment: strict(parsed?.judgment), english: strict(parsed?.english), behaviour: strict(parsed?.behaviour) };
  // Technical is measured from the frozen ledger when available
  if (weightedTechnical !== null) dims.technical = weightedTechnical;
  if ([dims.technical, dims.judgment, dims.english, dims.behaviour].some((v) => v === null)) return retry('ai_invalid_dimensions');

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
  const certCandidate = `SMC-${String(Math.round(overall * 100)).padStart(3, "0")}-${abbrevMap[rank] || "CR"}-${new Date().getFullYear()}`;
  const { data: cm, error: cmErr } = await adminClient.rpc('finalize_assessment_commit', {
    p_assessment_id: assessmentId, p_paper_id: P.paper_id, p_caller: caller,
    p_scores: scores, p_level_profile: levelProfile, p_red_flags: redFlags, p_certificate_id: certCandidate,
  });
  const C: any = cm;
  if (cmErr || !C?.ok) {
    console.error("score commit failed", cmErr?.message || C?.error_code);
    return J({ error_code: 'PERSIST_FAILED', detail: C?.error_code || null }, 503);
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
