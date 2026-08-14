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

  const rateLimitKey = `score-assessment:${clientIP}`;
  const windowMs = 10 * 60 * 1000;
  const maxAttempts = 5;
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

  if (await aiPaused(adminClient)) return aiPausedResponse(cors);

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  const { rank, firstName, transcript, candidateContext, assessmentId, redFlags } = await req.json();

  const hasTranscript = Array.isArray(transcript) && transcript.length > 0;
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
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 300, temperature: 0.2 }),
  });
  const data = await res.json();
  await meterAi(adminClient, { userId: gate.userId, feature: "score-assessment", model: "gpt-4o", usage: data?.usage, success: res.ok, latencyMs: Date.now() - _t0 });

  const text = (data.choices?.[0]?.message?.content || "{}").replace(/```json|```/g, "").trim();

  const clamp = (n: any) => {
    const v = Number(n);
    if (!isFinite(v)) return null;
    return Math.max(0, Math.min(5, Math.round(v * 100) / 100));
  };

  // Fallback derived from the real transcript, never a flat 5
  const transcriptAvg = hasTranscript
    ? transcript.reduce((s: number, t: any) => s + (Number(t.score) || 0), 0) / transcript.length / 2
    : 2.5;

  let dims: any = {};
  try {
    const parsed = JSON.parse(text);
    dims = {
      technical: clamp(parsed.technical),
      judgment: clamp(parsed.judgment),
      english: clamp(parsed.english),
      behaviour: clamp(parsed.behaviour),
    };
  } catch {
    dims = {};
  }

  // Any missing dimension falls back to the transcript average, not a fixed number
  const fb = Math.max(0, Math.min(5, Math.round(transcriptAvg * 100) / 100));
  dims.technical = dims.technical ?? fb;
  dims.judgment  = dims.judgment  ?? fb;
  dims.english   = dims.english   ?? fb;
  dims.behaviour = dims.behaviour ?? fb;
  

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
  };

  // ── Canonical write: only the service role may write scores (tamper trigger) ──
  let certificateId: string | null = null;
  let writeOk = true;
  let writeError: string | null = null;
  if (assessmentId) {
    const abbrevMap: Record<string, string> = {
      "Master": "MA", "Chief Officer": "CO", "2nd Officer": "2O", "3rd Officer": "3O",
      "Chief Engineer": "CE", "Second Engineer": "2E", "3rd Engineer": "3E",
      "AB": "AB", "Bosun": "BO", "Cook": "CK", "Motorman": "MM", "Electrician": "EL",
    };
    const abbrev = abbrevMap[rank] || "CR";
    certificateId = `SMC-${String(Math.round(overall * 100)).padStart(3, "0")}-${abbrev}-${new Date().getFullYear()}`;
    const { data: written, error: writeErr } = await adminClient.from("smc_assessments").update({
      technical_score: dims.technical,
      judgment_score: dims.judgment,
      english_score: dims.english,
      behavioural_score: dims.behaviour,
      overall_score: overall,
      score_band: band,
      recommendation,
      scoring_version: "v1.1",
      certificate_id: certificateId,
      dimension_scores: {
        technical: dims.technical,
        judgment: dims.judgment,
        maritime_english: dims.english,
        professional_behaviour: dims.behaviour,
      },
      red_flags: Array.isArray(redFlags) ? redFlags : [],
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", assessmentId).select("id");
    if (writeErr) {
      writeOk = false;
      writeError = writeErr.message;
      console.error("score write failed", writeErr.message);
    } else if (!written || written.length === 0) {
      writeOk = false;
      writeError = "Assessment row not found or not updated (0 rows affected)";
      console.error("score write affected 0 rows for", assessmentId);
    }
    if (writeOk) {
      try {
        const { data: arow } = await adminClient
          .from("smc_assessments")
          .select("crew_profile_id, probed_claims")
          .eq("id", assessmentId)
          .maybeSingle();
        const crewId = (arow as any)?.crew_profile_id;
        const probedRaw = (arow as any)?.probed_claims;
        const probed: string[] = Array.isArray(probedRaw)
          ? probedRaw.map((k: any) => String(k)).filter(Boolean)
          : [];
        // Only claims the interview actually probed get promoted to ASSESSED
        if (crewId && probed.length) {
          await adminClient
            .from("crew_claims")
            .update({ status: "ASSESSED", assessed_at: new Date().toISOString() })
            .eq("crew_id", crewId)
            .eq("status", "CLAIMED")
            .in("claim_key", probed);
        }
      } catch (_e) { /* claim promotion never blocks scoring */ }
    }
  }

  return new Response(JSON.stringify({
    scores: { ...scores, certificate_id: certificateId },
    write_ok: writeOk,
    ...(writeOk ? {} : { write_error: writeError }),
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});

