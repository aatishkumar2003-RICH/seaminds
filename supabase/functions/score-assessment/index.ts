import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });
  }

  // ── Rate limiting ──
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const { createClient } = await import('jsr:@supabase/supabase-js@2');
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
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

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const { rank, firstName, transcript, candidateContext } = await req.json();
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

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 300, temperature: 0.2 }),
  });
  const data = await res.json();
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
  dims.wellness  = dims.wellness  ?? fb;

  // Overall is arithmetic, computed here — never an AI opinion. Weights sum to 1.00.
  const overall = Math.round((
    dims.technical * 0.30 +
    dims.judgment  * 0.25 +
    dims.english   * 0.20 +
    dims.behaviour * 0.15 +
    dims.wellness  * 0.10
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
    wellness: dims.wellness,
    overall,
    band,
    recommendation,
    scoring_version: "v1.0",
  };

  return new Response(JSON.stringify({ scores }), { headers: { ...cors, "Content-Type": "application/json" } });
});
