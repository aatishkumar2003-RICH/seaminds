import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ── Rate limiting ──
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const rateLimitKey = `generate-smc:${clientIP}`;
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const { createClient } = await import('jsr:@supabase/supabase-js@2');
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await adminClient.from('auth_rate_limits').select('*', { count: 'exact', head: true }).eq('identifier', rateLimitKey).gte('attempted_at', windowStart);
  if ((count || 0) >= 10) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait before continuing.' }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  await adminClient.from('auth_rate_limits').insert({ identifier: rateLimitKey, attempted_at: new Date().toISOString() });

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const { rank, vesselType, yearsExperience, department } = await req.json();

  // ── CLASSIFY CANDIDATE (deterministic — no AI needed) ──────────────────
  const yrs = Number(yearsExperience) || 0;
  let experience_tier = "MID";
  if (yrs < 3) experience_tier = "JUNIOR";
  else if (yrs >= 3 && yrs < 9) experience_tier = "MID";
  else if (yrs >= 9 && yrs <= 15) experience_tier = "SENIOR";
  else if (yrs > 15) experience_tier = "COMMAND";
  const rankUpper = (rank || "").toUpperCase();
  if (rankUpper.includes("MASTER") || rankUpper.includes("CHIEF ENGINEER")) experience_tier = "COMMAND";
  if (rankUpper.includes("CADET")) experience_tier = "JUNIOR";

  const dept = (department || "").toUpperCase();
  const isRating = ["AB","OS","OILER","FITTER","MOTORMAN"].some(r => rankUpper.includes(r));
  const isCatering = ["COOK","MESSMAN"].some(r => rankUpper.includes(r));

  const vt = (vesselType || "").toUpperCase();
  let ship_specialisation = "GENERAL";
  if (vt.includes("LNG")) ship_specialisation = "LNG";
  else if (vt.includes("LPG")) ship_specialisation = "LPG";
  else if (vt.includes("TANKER") || vt.includes("CHEMICAL") || vt.includes("OIL")) ship_specialisation = "TANKER";
  else if (vt.includes("BULK")) ship_specialisation = "BULK";
  else if (vt.includes("DUAL FUEL") || vt.includes("DUAL-FUEL")) ship_specialisation = "DUAL_FUEL";
  else if (vt.includes("OFFSHORE") || vt.includes("DP")) ship_specialisation = "OFFSHORE";
  else if (vt.includes("CONTAINER")) ship_specialisation = "CONTAINER";
  else if (vt.includes("RO-RO") || vt.includes("RORO")) ship_specialisation = "RORO";

  // ── BUILD SPECIALISATION CONTEXT ───────────────────────────────────────
  const shipContext: Record<string, string> = {
    LNG: "Include questions on BOG management, cargo cooling procedures, membrane vs Moss tanks, ESD system, reliquefaction plant.",
    LPG: "Include questions on LPG cargo properties, pressure relief systems, compressor operations, cargo cooling.",
    TANKER: "Include questions on inert gas system, crude oil washing, MARPOL Annex I/II, static electricity hazards, cargo contamination prevention.",
    BULK: "Include questions on IMSBC code, cargo liquefaction risks, hold preparation and inspection, trimming procedures.",
    DUAL_FUEL: "Include questions on ME-GI or XDF engines, gas safety management, fuel switching procedures, gas detection systems.",
    OFFSHORE: "Include questions on DP operations, station keeping, DP class requirements, crane or anchor handling.",
    CONTAINER: "Include questions on lashing and securing, stack weight, reefer cargo management, fumigation procedures.",
    RORO: "Include questions on ramp operations, securing vehicles, stability during loading, hazardous cargo on RO-RO.",
    GENERAL: "Use standard SOLAS, ISM, MLC, MARPOL questions relevant to the rank.",
  };

  // ── BUILD TIER CONTEXT ─────────────────────────────────────────────────
  const tierContext: Record<string, string> = {
    JUNIOR: "Focus on operational knowledge: watchkeeping duties, basic procedures, routine tasks. Ask WHAT and HOW questions. Expect procedural answers.",
    MID: "Focus on problem-solving: handling abnormal situations, equipment issues, cargo challenges. Ask WHAT WOULD YOU DO IF questions.",
    SENIOR: "Focus on leadership and management: managing crew, handling inspections, coordinating teams. Ask HOW DO YOU MANAGE questions.",
    COMMAND: "Focus on strategic command decisions: PSC/SIRE inspections, major incidents, commercial pressure vs safety, crisis management. Expect experience-based strategic answers.",
  };

  // ── BUILD DEPARTMENT QUESTION STYLE ───────────────────────────────────
  let deptStyle = "";
  if (isRating) {
    const ratingRole = rankUpper.includes('AB') ? 'Able Seaman (AB)' :
      rankUpper.includes('OS') ? 'Ordinary Seaman (OS)' :
      rankUpper.includes('OILER') ? 'Oiler' :
      rankUpper.includes('FITTER') ? 'Fitter' :
      rankUpper.includes('MOTORMAN') ? 'Motorman' : 'Rating';
    deptStyle = `This is a ${ratingRole} rating. Ask ONLY procedural compliance and basic safety questions. Topics: personal safety equipment (PPE), permit to work system, muster duties and emergency stations, basic firefighting equipment locations, lifeboat/liferaft duties, watchkeeping basics, ISPS security awareness, reporting defects to officers, working at height safety, confined space entry basics. For Fitter/Motorman also ask: basic machinery maintenance, lubrication routines, tool safety. For AB also ask: mooring rope handling, anchor operations, lookout duties, helm orders. Do NOT ask navigation, cargo management, engine systems, or leadership questions. Questions must be simple and direct — ratings answer in practical terms not theory.`;
  } else if (isCatering) {
    const cateringRole = rankUpper.includes('CHIEF COOK') || rankUpper.includes('CHIEF_COOK') ? 'Chief Cook' :
      rankUpper.includes('COOK') ? 'Cook' : 'Messman';
    deptStyle = `This is a ${cateringRole} in the Catering Department. Ask questions about: food safety and hygiene (HACCP basics), galley cleanliness and sanitation, food storage temperatures, allergen awareness, galley fire prevention and fire extinguisher use, emergency muster duties, ISPS security awareness, personal hygiene standards, waste disposal procedures, MLC 2006 crew welfare provisions. For Chief Cook also ask: menu planning for crew nutrition, food budgeting, managing stores, crew dietary requirements. Do NOT ask technical navigation, engine, or cargo questions. Questions must be practical and relevant to daily galley and ship safety duties.`;
  } else if (dept.includes("ENGINE") || rankUpper.includes("ENGINEER") || rankUpper.includes("ETO")) deptStyle = "This is an ENGINE DEPARTMENT officer. Ask TECHNICAL DIAGNOSIS questions: machinery systems, alarm responses, maintenance procedures, overhaul sequences. NOT navigation or cargo questions.";
  else deptStyle = "This is a DECK DEPARTMENT officer. Ask SCENARIO AND DECISION-MAKING questions: navigation situations, COLREGS, passage planning, cargo operations, safety management. NOT engine machinery questions.";

  const numTechnical = isRating || isCatering ? 4 : 5;
  const numComm = isRating || isCatering ? 2 : 3;
  const numBehav = isRating || isCatering ? 2 : 3;
  const totalQ = numTechnical + numComm + numBehav;

  const userMessage = `Generate interview questions for a seafarer with this exact profile:
Rank: ${rank}
Department: ${department}
Vessel Type: ${vesselType}
Years Experience in Rank: ${yearsExperience}
Experience Tier: ${experience_tier}
Ship Specialisation: ${ship_specialisation}

DEPARTMENT STYLE: ${deptStyle}
EXPERIENCE DEPTH: ${tierContext[experience_tier]}
VESSEL SPECIALISATION: ${shipContext[ship_specialisation] || shipContext.GENERAL}

Generate exactly ${numTechnical} technical questions, ${numComm} communication questions, and ${numBehav} behavioural questions (${totalQ} total).
Questions must be specific to this exact profile — NOT generic for all seafarers.
A ${rank} on a ${vesselType} with ${yearsExperience} years should get completely different questions from a cadet on a bulk carrier.

Return ONLY valid JSON, no markdown, no explanation:
{ "technical": [${numTechnical} strings], "communication": [${numComm} strings], "behavioural": [${numBehav} strings] }`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a senior maritime superintendent generating interview questions. Return ONLY valid JSON, no markdown backticks, no explanation." },
        { role: "user", content: userMessage }
      ],
      max_tokens: 1200,
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "{}";
  const clean = text.replace(/```json|```/g, "").trim();

  let questions;
  try { questions = JSON.parse(clean); }
  catch { questions = { technical: [], communication: [], behavioural: [] }; }

  // Return questions + the classified context (useful for evaluate-answer later)
  return new Response(JSON.stringify({
    ...questions,
    candidate_context: { rank, department, experience_tier, ship_specialisation, yearsExperience, vesselType }
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
