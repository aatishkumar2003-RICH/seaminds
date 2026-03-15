import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const { rank, firstName, transcript, candidateContext } = await req.json();
  const hasTranscript = Array.isArray(transcript) && transcript.length > 0;
  const transcriptText = hasTranscript
    ? transcript.map((t: any, i: number) => `Q${i+1}: ${t.question}\nAnswer: ${t.answer}\nScore: ${t.score}/10${t.redFlag ? ' [RED FLAG: '+t.redFlagCategory+']' : ''}${t.followUp ? '\nFollow-up: '+t.followUp : ''}`).join('\n\n')
    : 'No transcript available.';
  const prompt = `You are a senior maritime superintendent scoring a seafarer interview.
Candidate: ${firstName}, ${rank}, ${candidateContext?.experience_tier || 'MID'} tier, ${candidateContext?.ship_specialisation || 'GENERAL'} vessel.
Full interview transcript:
${transcriptText}
Score each dimension 0-10 based on the transcript. Return ONLY valid JSON (no markdown):
{ "technical": 0-10, "safety": 0-10, "operational": 0-10, "leadership": 0-10, "communication": 0-10, "overall": 0-5 }
overall = weighted average: technical*0.30 + safety*0.20 + operational*0.20 + leadership*0.15 + communication*0.10 + 0.5 (risk baseline).
Round overall to 2 decimal places. If no transcript, return mid-range scores.`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], max_tokens: 200, temperature: 0.2 }),
  });
  const data = await res.json();
  const text = (data.choices?.[0]?.message?.content || "{}").replace(/```json|```/g,"").trim();
  let scores;
  try { scores = JSON.parse(text); } catch { scores = { technical:5, safety:5, operational:5, leadership:5, communication:5, overall:2.50 }; }
  return new Response(JSON.stringify({ scores }), { headers: { ...cors, "Content-Type": "application/json" } });
});
