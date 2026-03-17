import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  // ── Rate limiting ──
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const { createClient } = await import('jsr:@supabase/supabase-js@2');
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const rateLimitKey = `evaluate-answer:${clientIP}`;
  const windowMs = 10 * 60 * 1000;
  const maxAttempts = 30;
  const { data: rl } = await adminClient.from('auth_rate_limits').select('*').eq('ip_address', rateLimitKey).maybeSingle();
  const now = Date.now();
  if (rl) {
    const windowStart = new Date(rl.window_start).getTime();
    if (now - windowStart < windowMs && rl.attempt_count >= maxAttempts) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait before continuing.' }), { status: 429, headers: corsHeaders });
    }
    if (now - windowStart >= windowMs) {
      await adminClient.from('auth_rate_limits').update({ attempt_count: 1, window_start: new Date().toISOString(), last_attempt: new Date().toISOString() }).eq('ip_address', rateLimitKey);
    } else {
      await adminClient.from('auth_rate_limits').update({ attempt_count: rl.attempt_count + 1, last_attempt: new Date().toISOString() }).eq('ip_address', rateLimitKey);
    }
  } else {
    await adminClient.from('auth_rate_limits').insert({ ip_address: rateLimitKey, attempt_count: 1, window_start: new Date().toISOString(), last_attempt: new Date().toISOString() });
  }

  const body = await req.json();
  const { question, answer, question_type, correct_index, correct_letter, explanation, key_steps, critical_step, rank, experience_tier, department } = body;

  const sanitize = (str: string, maxLen: number) => (str || '').toString().substring(0, maxLen).trim();
  const cleanAnswer = sanitize(answer, 2000);

  if (!cleanAnswer || cleanAnswer.length < 1) {
    return new Response(JSON.stringify({ score: 0, strength_level: "WEAK", red_flag: false, red_flag_category: null, red_flag_evidence: null, follow_up_question: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // MCQ — pure objective scoring, no AI needed
  if (question_type === 'mcq') {
    const selected = parseInt(cleanAnswer);
    const isCorrect = selected === correct_index;
    return new Response(JSON.stringify({
      score: isCorrect ? 10 : 0,
      strength_level: isCorrect ? 'STRONG' : 'WEAK',
      red_flag: !isCorrect,
      red_flag_category: !isCorrect ? 'KNOWLEDGE_GAP' : null,
      red_flag_evidence: !isCorrect ? `Wrong answer selected for regulatory MCQ. Correct: ${correct_letter}` : null,
      follow_up_question: !isCorrect ? `The correct answer was ${correct_letter}. ${explanation || ''}. Can you explain the regulation behind this?` : null
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Scenario or Behavioural — AI evaluation
  const cleanQuestion = sanitize(question, 500);
  const cleanRank = sanitize(rank, 100);
  const cleanTier = sanitize(experience_tier, 50);

  const scenarioPrompt = question_type === 'scenario' ? `
You are a strict maritime examiner evaluating an emergency scenario response.
Rank: ${cleanRank}, Experience: ${cleanTier}
Scenario answer: "${cleanAnswer}"
Key steps expected: ${JSON.stringify(key_steps || [])}
Critical step (MUST be present): "${critical_step || ''}"

Score 0-10 STRICTLY:
- If critical_step is missing: maximum score is 4
- Award 1 point per key_step mentioned (up to 4 points)
- Award 2 points for correct prioritisation order
- Award 2 points if critical_step mentioned
- Deduct 3 points for any dangerous/incorrect action mentioned
- Empty or irrelevant answer: score 0-1
- Generic answer with no specifics: score 2-3
` : `
You are a maritime welfare officer and senior examiner evaluating a behavioural/wellness response.
Rank: ${cleanRank}
Question: "${cleanQuestion}"
Answer: "${cleanAnswer}"

Score 0-10:
- Score 8-10: mature, self-aware, constructive response
- Score 5-7: adequate but surface-level response
- Score 2-4: dismissive, avoidant, or concerning response
- Score 0-1: refuses to answer or extremely concerning

RED FLAG (set red_flag: true) if answer indicates: thoughts of self-harm, severe isolation, inability to cope, hiding safety incidents, extreme fatigue affecting judgment.
YELLOW (red_flag_category: 'WELLNESS_CONCERN') if: mild stress, family worry, moderate fatigue.
`;

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const completion = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0.3,
      messages: [
        { role: 'system', content: scenarioPrompt },
        { role: 'user', content: 'Return ONLY valid JSON: { "score": number 0-10, "strength_level": "STRONG|ADEQUATE|WEAK", "red_flag": boolean, "red_flag_category": string|null, "red_flag_evidence": string|null, "follow_up_question": string|null }' }
      ]
    })
  });

  const result = await completion.json();
  const text = (result.choices?.[0]?.message?.content || '{}').replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(text);
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ score: 0, strength_level: 'WEAK', red_flag: false, red_flag_category: null, red_flag_evidence: null, follow_up_question: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
