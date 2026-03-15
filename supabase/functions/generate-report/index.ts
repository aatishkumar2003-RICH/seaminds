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
  const rateLimitKey = `generate-report:${clientIP}`;
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
  const { rank, firstName, transcript, scores, redFlags, candidateContext } = await req.json();
  const transcriptText = Array.isArray(transcript) && transcript.length > 0
    ? transcript.map((t: any, i: number) => `Q${i+1}: ${t.question}\nAnswer: ${t.answer}\nScore: ${t.score}/10`).join('\n\n')
    : 'No transcript available.';
  const redFlagText = Array.isArray(redFlags) && redFlags.length > 0
    ? redFlags.map((f: any) => `[${f.category}] "${f.evidence}"`).join('\n')
    : 'None detected.';
  const prompt = `You are a senior maritime superintendent writing a professional crew evaluation report.
Candidate: ${firstName}, Rank: ${rank}, Tier: ${candidateContext?.experience_tier || 'MID'}, Vessel: ${candidateContext?.ship_specialisation || 'GENERAL'}.
Scores: Technical ${scores?.technical}/10, Safety ${scores?.safety}/10, Operational ${scores?.operational}/10, Leadership ${scores?.leadership}/10, Communication ${scores?.communication}/10.
Red flags detected: ${redFlagText}
Interview transcript:
${transcriptText}
Write a professional evaluation. Return ONLY valid JSON (no markdown):
{ "findings": ["4-6 specific observations referencing actual answers — concrete not generic"], "remarks": "3 paragraphs: (1) overall competency vs rank, (2) strongest competencies with evidence, (3) concerns and recommendation. Superintendent tone. No bullet points.", "improvement_areas": [{"area": "string", "severity": "Critical|Moderate|Minor", "detail": "string"}], "training_recommendations": ["specific named STCW courses or training modules"], "recommendation": "SUITABLE|SUITABLE_WITH_TRAINING|HIGH_RISK|NOT_RECOMMENDED" }`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: 1500, temperature: 0.4 }),
  });
  const data = await res.json();
  const text = (data.choices?.[0]?.message?.content || "{}").replace(/```json|```/g,"").trim();
  let report;
  try { report = JSON.parse(text); } catch { report = { findings: ["Assessment completed."], remarks: "Report generation encountered an issue. Please review the scores above.", improvement_areas: [], training_recommendations: [], recommendation: "SUITABLE_WITH_TRAINING" }; }
  return new Response(JSON.stringify({ report }), { headers: { ...cors, "Content-Type": "application/json" } });
});
