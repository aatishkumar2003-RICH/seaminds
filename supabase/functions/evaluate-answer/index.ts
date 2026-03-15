import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ── Rate limiting ──
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const rateLimitKey = `evaluate-answer:${clientIP}`;
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const { createClient } = await import('jsr:@supabase/supabase-js@2');
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await adminClient.from('auth_rate_limits').select('*', { count: 'exact', head: true }).eq('identifier', rateLimitKey).gte('attempted_at', windowStart);
  if ((count || 0) >= 30) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait before continuing.' }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  await adminClient.from('auth_rate_limits').insert({ identifier: rateLimitKey, attempted_at: new Date().toISOString() });

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const { question, answer, rank, experience_tier, ship_specialisation, department } = await req.json();
  if (!answer || answer.trim().length < 3) {
    return new Response(JSON.stringify({ score: 0, strength_level: "WEAK", red_flag: false, red_flag_category: null, red_flag_evidence: null, follow_up_question: "Could you please elaborate on your answer?" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const prompt = `You are a senior maritime superintendent evaluating a seafarer interview answer. Candidate: ${rank}, ${experience_tier} tier, ${ship_specialisation} vessel, ${department} department. Question: ${question} Answer: ${answer} Return ONLY valid JSON (no markdown): { "score": 0-10, "strength_level": "STRONG|ADEQUATE|WEAK", "red_flag": true/false, "red_flag_category": null or "Safety" or "Attitude" or "Compliance" or "Knowledge", "red_flag_evidence": null or exact quote, "follow_up_question": null or one follow-up question string if score is below 5 } Scoring: 8-10=correct and detailed, 5-7=partial or lacking depth, 0-4=incorrect or dangerous or no real answer. Red flag: unsafe thinking, blaming others, ignoring procedures, wrong emergency answer, commercial over safety.`;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: 250, temperature: 0.3 }),
  });
  const data = await response.json();
  const text = (data.choices?.[0]?.message?.content || "{}").replace(/```json|```/g,"").trim();
  let result;
  try { result = JSON.parse(text); } catch { result = { score: 5, strength_level: "ADEQUATE", red_flag: false, red_flag_category: null, red_flag_evidence: null, follow_up_question: null }; }
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
