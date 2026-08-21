import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authGate, aiPaused, aiPausedResponse, meterAi } from "../_shared/aiGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-worker-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') || '';

  // ── Rate limiting ──
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const { createClient } = await import('jsr:@supabase/supabase-js@2');
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── Auth gate: worker secret OR real signed-in user ──
  const gate = await authGate(req, adminClient, corsHeaders);
  if (!gate.ok) return gate.response;

  const rateLimitKey = `generate-smc:${clientIP}`;

  const windowMs = 10 * 60 * 1000;
  const maxAttempts = 10;
  const { data: rl } = await adminClient.from('auth_rate_limits').select('*').eq('ip_address', rateLimitKey).maybeSingle();
  const now = Date.now();
  if (rl) {
    const windowStart = new Date(rl.window_start).getTime();
    if (now - windowStart < windowMs && rl.attempt_count >= maxAttempts) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait before continuing.' }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
  const { rank: _rank, vesselType: _vesselType, yearsExperience: _yearsExperience, department: _department, assessmentId: _assessmentId, mode: _mode } = await req.json();
  const sanitize = (str: string, maxLen: number) => (str || '').toString().substring(0, maxLen).trim();
  const rank = sanitize(_rank, 100);
  let vesselType = sanitize(_vesselType, 100);
  let department = sanitize(_department, 100);
  let yearsExperience = Math.min(Math.max(Number(_yearsExperience) || 0, 0), 60);

  // ── PRIVACY MODE: company-commissioned interviews never touch wellness topics ──
  let interviewMode: 'self' | 'company' = _mode === 'company' ? 'company' : (_mode === 'self' ? 'self' : 'self');
  if (_mode !== 'company' && _mode !== 'self' && _assessmentId) {
    // Default inferred from the assessment's link to a campaign / interview invite
    const { data: prog } = await adminClient
      .from('interview_progress')
      .select('campaign_id')
      .eq('assessment_id', _assessmentId)
      .maybeSingle();
    if (prog?.campaign_id) interviewMode = 'company';
    else {
      const { data: inv } = await adminClient
        .from('interview_invites')
        .select('id')
        .eq('assessment_id', _assessmentId)
        .maybeSingle();
      if (inv?.id) interviewMode = 'company';
    }
  }
  const isCompanyMode = interviewMode === 'company';
  if (_assessmentId) {
    await adminClient.from('smc_assessments').update({ interview_mode: interviewMode }).eq('id', _assessmentId);
  }

  // ── RESOLVE CANDIDATE CONTEXT SERVER-SIDE (canonical DB helpers only) ──
  let yearsInRank: number | null = null;
  let contractsInRank: number | null = null;
  let cvClaims: string[] = [];
  let probedClaimKeys: string[] = [];
  let probeUid: string | null = null;

  try {
    const { data: rr } = await adminClient.rpc('resolve_rank', { p_rank: rank });
    const resolved: any = rr || null;
    if (resolved?.department) department = String(resolved.department);
  } catch (_e) { /* rank resolution optional */ }

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = await adminClient.auth.getUser(token);
    const uid = userData?.user?.id;
    probeUid = uid || null;
    if (uid) {
      const { data: cv } = await adminClient
        .from('crew_cv_data')
        .select('sea_service')
        .eq('user_id', uid)
        .maybeSingle();
      const service = Array.isArray((cv as any)?.sea_service) ? (cv as any).sea_service : [];
      const matching = service.filter((s: any) =>
        (s?.rank || s?.position || '').toString().toLowerCase().includes(rank.toLowerCase().slice(0, 12))
      );
      if (matching.length) {
        contractsInRank = matching.length;
        const months = matching.reduce((sum: number, s: any) => {
          const m = Number(s?.months ?? s?.duration_months ?? s?.duration ?? 0);
          return sum + (isFinite(m) ? m : 0);
        }, 0);
        yearsInRank = months > 0 ? Math.round((months / 12) * 10) / 10 : null;
        cvClaims = matching
          .slice(0, 5)
          .map((s: any) => [s?.rank || s?.position, s?.vessel_type, s?.vessel_name].filter(Boolean).join(' — '))
          .filter((s: string) => s.length > 2);
      }

      // Quick-profile calibration fallback — canonical band helpers
      if (yearsInRank === null || contractsInRank === null) {
        try {
          const { data: qp } = await adminClient
            .from('crew_profiles')
            .select('years_in_rank_band, contracts_in_rank_band')
            .eq('id', uid)
            .maybeSingle();
          if (yearsInRank === null && (qp as any)?.years_in_rank_band) {
            const { data: ym } = await adminClient.rpc('band_years_midpoint', { p_band: (qp as any).years_in_rank_band });
            const n = Number(ym);
            if (isFinite(n)) yearsInRank = n;
          }
          if (contractsInRank === null && (qp as any)?.contracts_in_rank_band) {
            const { data: cm } = await adminClient.rpc('contracts_midpoint', { p_band: (qp as any).contracts_in_rank_band });
            const n = Number(cm);
            if (isFinite(n)) contractsInRank = n;
          }
        } catch (_e) { /* band fallback optional */ }
      }

      // Vessel context fallback: strongest quick-profile vessel family
      if (!vesselType) {
        try {
          const { data: exp } = await adminClient
            .from('crew_vessel_experience')
            .select('vessel_family, sea_time_band')
            .eq('crew_id', uid);
          let bestFamily: string | null = null;
          let bestScore = -1;
          for (const row of (exp || []) as any[]) {
            let score = 0;
            try {
              const { data: bm } = await adminClient.rpc('band_years_midpoint', { p_band: row?.sea_time_band });
              const n = Number(bm);
              if (isFinite(n)) score = n;
            } catch (_e) { /* band scoring optional */ }
            if (row?.vessel_family && score > bestScore) { bestScore = score; bestFamily = String(row.vessel_family); }
          }
          if (bestFamily) vesselType = bestFamily;
        } catch (_e) { /* vessel fallback optional */ }
      }

      // Quick-profile self-declared claims (FACT/CLAIM/VERIFIED loop)
      try {
        const { data: qc } = await adminClient
          .from('crew_claims')
          .select('claim_key, value')
          .eq('crew_id', uid)
          .eq('status', 'CLAIMED');
        const skip = new Set(['no', 'none', '0', '']);
        const pretty = (k: string, v: string): string => {
          const vals = v.split(',').map((x) => x.trim()).filter(Boolean);
          const joined = vals.length > 1
            ? `${vals.slice(0, -1).join(', ')} and ${vals[vals.length - 1]}`
            : (vals[0] || v);
          switch (k) {
            case 'sire_experience': return `Claims SIRE inspection experience (${v})`;
            case 'rightship_experience': return 'Claims RightShip inspection experience';
            case 'psc_experience': return `Claims Port State Control inspection experience (${v})`;
            case 'ecdis_experience': return 'Claims ECDIS operational experience';
            case 'ecdis_types': return `Claims ECDIS experience on ${joined}`;
            case 'dp_qualification': return `Claims DP qualification: ${v}`;
            case 'mooring_experience': return 'Claims mooring operations experience';
            case 'watchkeeping_lookout': return 'Claims bridge watchkeeping/lookout duty experience';
            case 'helmsman': return 'Claims helmsman experience';
            case 'cargo_ops_watch': return 'Claims cargo operations watchkeeping experience';
            case 'tanker_deck_ops': return 'Claims tanker deck cargo operations experience';
            case 'lashing_securing': return 'Claims lashing and cargo securing experience';
            case 'anchor_handling_deck': return 'Claims anchor handling deck experience';
            case 'propulsion_experience': return `Claims propulsion experience: ${joined}`;
            case 'cargo_pumping_systems': return `Claims ${joined} cargo pump experience`;
            case 'hv_certified': return 'Claims High Voltage certification';
            case 'ums_experience': return 'Claims UMS (unmanned machinery space) experience';
            case 'welding_machining': return 'Claims welding and machining experience';
            case 'tanker_engine_room': return 'Claims tanker engine room experience';
            case 'dp_vessel_experience': return 'Claims DP vessel experience';
            case 'hazardous_area_ex': return 'Claims hazardous area / Ex equipment experience';
            case 'automation_systems': return `Claims automation systems experience: ${joined}`;
            case 'crew_size_cooked': return `Claims catering for crew size ${v}`;
            case 'multicultural_menus': return 'Claims multicultural menu planning experience';
            case 'haccp_trained': return 'Claims HACCP training';
            case 'provisioning_budget': return 'Claims provisioning and budget control experience';
            default: return `Claims ${k.replace(/_/g, ' ')}: ${v}`;
          }
        };
        const usable = (qc || []).filter((c: any) => !skip.has(String(c?.value ?? '').trim().toLowerCase()));
        const extra = usable.map((c: any) => pretty(String(c.claim_key), String(c.value)));
        const before = cvClaims.length;
        cvClaims = [...cvClaims, ...extra].slice(0, 8);
        const included = Math.max(0, cvClaims.length - before);
        probedClaimKeys = usable.slice(0, included).map((c: any) => String(c.claim_key));
      } catch (_e) { /* quick-profile claims optional */ }
    }
  } catch (_e) { /* candidate context lookup optional */ }

  // Years actually used for tiering: request value, else resolved sea service / bands
  if (!yearsExperience && yearsInRank !== null) {
    yearsExperience = Math.min(Math.max(yearsInRank, 0), 60);
  }

  // ── CLASSIFY CANDIDATE ──
  const yrs = Number(yearsExperience) || 0;
  let experience_tier = "MID";
  if (yrs < 3) experience_tier = "JUNIOR";
  else if (yrs >= 3 && yrs < 9) experience_tier = "MID";
  else if (yrs >= 9 && yrs <= 15) experience_tier = "SENIOR";
  else if (yrs > 15) experience_tier = "COMMAND";
  const rankUpper = (rank || "").toUpperCase();
  if (rankUpper.includes("MASTER") || rankUpper.includes("CHIEF ENGINEER")) experience_tier = "COMMAND";
  if (rankUpper.includes("CADET")) experience_tier = "JUNIOR";

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

  // ── OFFICER vs RATING classification ──
  const OFFICER_RANKS = ['Master','Captain','Chief Officer','Chief Mate','2nd Officer','Second Officer','3rd Officer','Third Officer','Chief Engineer','Second Engineer','2nd Engineer','Third Engineer','3rd Engineer','ETO','Electrical Officer','Electro-Technical Officer'];
  const RATING_KEYWORDS = ['ab','os','oiler','fitter','motorman','cook','messman','chief cook','steward'];
  const isOfficer = OFFICER_RANKS.some(r => rank.toLowerCase().includes(r.toLowerCase())) || (!RATING_KEYWORDS.some(r => rank.toLowerCase().includes(r)));
  const mcqCount = isOfficer ? 30 : 10;
  const scenarioCount = isOfficer ? 5 : 3;
  const behaviouralCount = isOfficer ? 5 : 4;
  const totalQuestions = mcqCount + scenarioCount + behaviouralCount;

  // ── QUESTION BANK LOGIC ──
  const rankGroup = isOfficer ? 'OFFICER' : 'RATING';
  const domains = isOfficer
    ? [{ domain: 'safety', count: 10 }, { domain: 'security', count: 5 }, { domain: 'management', count: 8 }, { domain: 'technical', count: 7 }]
    : [{ domain: 'safety', count: 4 }, { domain: 'security', count: 2 }, { domain: 'watchkeeping', count: 2 }, { domain: 'technical', count: 2 }];

  const bankMCQ: any[] = [];
  let bankHasEnough = true;

  for (const { domain, count } of domains) {
    const { data: questions } = await adminClient
      .from('question_bank')
      .select('*')
      .eq('rank_group', rankGroup)
      .eq('domain', domain)
      .eq('active', true)
      .order('times_used', { ascending: true })
      .limit(count * 3);

    if (!questions || questions.length < count) {
      bankHasEnough = false;
      break;
    }

    const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, count);

    shuffled.forEach((q: any) => {
      const options = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options as string[]);
      const correctAnswer = options[q.correct_index];
      const shuffledOptions = [...options].sort(() => Math.random() - 0.5);
      const newCorrectIndex = shuffledOptions.indexOf(correctAnswer);
      bankMCQ.push({
        id: q.id,
        domain: q.domain,
        question: q.question,
        options: shuffledOptions,
        correct_index: newCorrectIndex,
        correct_letter: ['A','B','C','D'][newCorrectIndex],
        regulation: q.regulation,
        explanation: q.explanation
      });
      adminClient.from('question_bank').update({ times_used: (q.times_used || 0) + 1 }).eq('id', q.id);
    });
  }

  if (bankHasEnough && bankMCQ.length >= mcqCount) {
    console.log(`Using ${bankMCQ.length} questions from question bank`);
  }

  // ── BUILD VESSEL SPECIALISATION CONTEXT ──
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

  // ── AI INTERVIEW V2 — RESOLVE INTERVIEW SPEC (never blocks) ──
  let spec: any = null;
  try {
    const { data: specData } = await adminClient.rpc('resolve_interview_spec_v2', {
      p_rank: rank,
      p_years_in_rank: yearsInRank ?? 2,
      p_contracts_in_rank: contractsInRank ?? 3,
      p_vessel: vesselType,
      p_specialist: null,
      p_cv_claims: cvClaims,
      p_vacancy_topics: [],
    });
    spec = specData || null;
  } catch (_e) {
    spec = null;
  }


  // Record which quick-profile claims this interview targets — never blocks generation
  const recordProbedClaims = async () => {
    try {
      if (!probedClaimKeys.length) return;
      const bodyAssessmentId = sanitize((_assessmentId as string) || '', 60);
      let targetId: string | null = bodyAssessmentId || null;
      if (!targetId && probeUid) {
        const { data: a } = await adminClient
          .from('smc_assessments')
          .select('id')
          .eq('crew_profile_id', probeUid)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        targetId = (a as any)?.id || null;
      }
      if (!targetId) return;
      await adminClient.from('smc_assessments').update({ probed_claims: probedClaimKeys }).eq('id', targetId);
      console.log(`probed_claims written: ${probedClaimKeys.length} claim_keys for assessment ${targetId}`);
    } catch (_e) { /* probed-claims tracking never blocks generation */ }
  };

  const list = (v: any) => (Array.isArray(v) ? v : []);
  const specBlock = spec ? `
── INTERVIEW SPEC V2 (authoritative — build questions from this) ──
Department: ${spec.department} · Rank group: ${spec.rank_group} · Seniority: ${spec.seniority} · Vessel family: ${spec.vessel_family}
Base topics: ${list(spec.base_topics).join('; ') || 'n/a'}
Seniority topics: ${list(spec.seniority_topics).join('; ') || 'n/a'}
Vessel topics: ${list(spec.vessel_topics).join('; ') || 'n/a'}
Specialist topics: ${list(spec.specialist_topics).join('; ') || 'n/a'}
Split of judgement vs hard-knowledge emphasis: scenario weight ${spec.scenario_weight}% / technical weight ${spec.technical_weight}%.
Scenario ambiguity level: ${spec.ambiguity_level}. ${String(spec.seniority) === 'VETERAN' ? 'Scenarios must be layered command situations with incomplete information, conflicting priorities and commercial pressure — but technical questions must STILL verify hard regulatory evidence.' : ''}
CV claims to verify (one targeted question each): ${list(spec.cv_claims_to_verify).join('; ') || 'none'}
Vacancy requirements (one targeted question each): ${list(spec.vacancy_requirements).join('; ') || 'none'}
Note: ${spec.generation_note || ''}
Apply this spec while keeping the exact question counts, difficulty scale and JSON output structure specified below.
` : '';

  // ── DETERMINE WHAT GPT NEEDS TO GENERATE ──
  const needGptMCQ = !bankHasEnough || bankMCQ.length < mcqCount;

  // ── MCQ DOMAIN DISTRIBUTION (only if GPT needed for MCQ) ──
  let mcqDistribution: string;
  if (isOfficer) {
    mcqDistribution = `Generate exactly ${mcqCount} MCQ questions in these EXACT proportions:
- Safety domain (10 questions): SOLAS fire detection, LSA requirements, emergency procedures, stability, GMDSS, muster, abandon ship, enclosed space entry, hot work permits, MOB procedures
- Security domain (5 questions): ISPS Code, Ship Security Plan, security levels 1/2/3, Declaration of Security, access control, crew ID verification
- Management & MLC domain (8 questions): MLC 2006 rest hours (max 14hrs work/24hrs, 72hrs/week), STCW watch hours, port state control, flag state requirements, SMS documentation, ISM Code, near miss reporting, safety committee
- Technical domain (7 questions): vessel-type specific cargo operations, navigation equipment, propulsion, chartwork regulations, bridge procedures`;
  } else {
    mcqDistribution = `Generate exactly ${mcqCount} MCQ questions in these EXACT proportions:
- Safety domain (4 questions): PPE usage, muster station duties, fire watch procedures, immersion suit donning
- Security domain (2 questions): access control responsibilities, reporting suspicious persons/items
- Watchkeeping domain (2 questions): lookout duties, communication with OOW, AB/OS specific bridge procedures
- Technical domain (2 questions): basic maintenance, role-specific equipment operation`;
  }

  const mcqSection = needGptMCQ ? `SECTION 1 — MCQ (Multiple Choice Questions)
${mcqDistribution}

Each MCQ must have exactly 4 options (A, B, C, D). Only ONE is correct.
Every correct answer must be definitively correct according to the referenced convention.
Wrong answers must be plausible but clearly incorrect to anyone with proper knowledge.` : 'SECTION 1 — MCQ: SKIP (already sourced from question bank)';

  const userMessage = `Generate assessment questions for this seafarer profile:
Rank: ${rank}
Department: ${department}
Vessel Type: ${vesselType}
Years Experience: ${yearsExperience}
Experience Tier: ${experience_tier}
Ship Specialisation: ${ship_specialisation}
Classification: ${isOfficer ? 'OFFICER' : 'RATING'}

VESSEL SPECIALISATION CONTEXT: ${shipContext[ship_specialisation] || shipContext.GENERAL}
${specBlock}

${mcqSection}

SECTION 2 — SCENARIO QUESTIONS
Generate exactly ${scenarioCount} scenario-based questions. Each scenario must include:
- A detailed situation description with vessel position, weather conditions, and time
- A clear question asking for immediate actions in order of priority
- 4 key steps that should be in the answer
- One critical step that MUST be present
- Time limit of 180 seconds

SECTION 3 — ${isCompanyMode ? 'PROFESSIONAL BEHAVIOUR QUESTIONS' : 'BEHAVIOURAL QUESTIONS'}
${isCompanyMode
? `Generate exactly ${behaviouralCount} PROFESSIONAL BEHAVIOUR questions covering ONLY these categories:
leadership, communication, accountability, safety_culture, challenge_and_response, conflict_handling, decision_making, teamwork

PRIVACY RESTRICTION — MANDATORY:
NEVER generate questions about stress, mental health, family, personal life, fatigue, sleep, mood, wellbeing, coping, or emotions. This is a professional employment assessment.`
: `Generate exactly ${behaviouralCount} behavioural/wellness questions covering categories:
stress, leadership, family, conflict, fatigue, safety_culture, mental_health`}

Return ONLY valid JSON (no markdown, no explanation) in this EXACT structure:
{
  ${needGptMCQ ? `"mcq": [
    {
      "id": "mcq_1",
      "domain": "safety|security|management|technical",
      "question": "Exact question text",
      "options": ["A. Option text", "B. Option text", "C. Option text", "D. Option text"],
      "correct_index": 0,
      "correct_letter": "A",
      "regulation": "SOLAS Chapter II-2 Reg 10",
      "explanation": "Why this answer is correct with regulatory reference"
    }
  ],` : ''}
  "scenario": [
    {
      "id": "scen_1",
      "domain": "emergency|cargo|navigation|engineering",
      "situation": "Detailed scenario description including vessel position, conditions, time",
      "question": "What are your immediate actions in order of priority?",
      "key_steps": ["First action", "Second action", "Third action", "Fourth action"],
      "critical_step": "The single most important step that MUST be in the answer",
      "time_seconds": 180
    }
  ],
  "behavioural": [
    {
      "id": "beh_1",
      "category": "${isCompanyMode ? 'leadership|communication|accountability|safety_culture|challenge_and_response|conflict_handling|decision_making|teamwork' : 'stress|leadership|family|conflict|fatigue|safety_culture|mental_health'}",
      "question": "Question text",
      "wellness_indicator": ${isCompanyMode ? 'false' : 'true'},
      "confidential": ${isCompanyMode ? 'false' : 'true'},
      "prompt_text": "${isCompanyMode ? 'This is a professional competency question assessed for the hiring company.' : 'Your response is confidential and will never be shared with your employer.'}"
    }
  ]
}`;

  const systemPrompt = `You are a senior maritime examiner and Flag State surveyor with 25 years experience. You examine officers and ratings for CoC (Certificate of Competency) and endorsements. Generate STRICTLY accurate questions based on SOLAS 2024, MARPOL 2024, MLC 2006, STCW 2010 Manila Amendments, ISPS Code, and ISM Code. Every correct answer must be definitively correct according to the referenced convention. Wrong answers must be plausible but clearly incorrect to anyone with proper knowledge. Questions must differentiate between competent and incompetent seafarers. Do NOT generate questions that can be answered by guessing or common sense alone. Return ONLY valid JSON, no markdown backticks, no explanation.${isCompanyMode ? ' PRIVACY RESTRICTION — MANDATORY: this is a company-commissioned professional employment assessment. NEVER generate questions about stress, mental health, family, personal life, fatigue, sleep, mood, wellbeing, coping, or emotions.' : ''}`;

  if (await aiPaused(adminClient)) return aiPausedResponse(corsHeaders);

  const _t0 = Date.now();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 8000,
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  await meterAi(adminClient, { userId: gate.userId, feature: "generate-smc-questions", model: "gpt-4o-mini", usage: data?.usage, success: response.ok, latencyMs: Date.now() - _t0 });

  const text = data.choices?.[0]?.message?.content || "{}";
  const clean = text.replace(/```json|```/g, "").trim();

  let questions;
  try { questions = JSON.parse(clean); }
  catch { questions = { mcq: [], scenario: [], behavioural: [] }; }

  // ── USE BANK MCQ OR GPT MCQ ──
  if (bankHasEnough && bankMCQ.length >= mcqCount) {
    questions.mcq = bankMCQ;
  } else {
    // Save GPT-generated MCQ to question bank for future use
    const generatedMCQ = questions.mcq || [];
    if (generatedMCQ.length > 0) {
      const toInsert = generatedMCQ.map((q: any) => ({
        rank_group: rankGroup,
        domain: q.domain || 'safety',
        vessel_type: vesselType || 'ALL',
        question: q.question,
        options: q.options,
        correct_index: q.correct_index,
        correct_letter: q.correct_letter,
        regulation: q.regulation,
        explanation: q.explanation,
        difficulty: 'INTERMEDIATE',
        active: true,
      }));
      await adminClient.from('question_bank').insert(toInsert);
      console.log(`Saved ${toInsert.length} new questions to bank`);
    }
  }

  // Ensure candidate_context is always present
  questions.candidate_context = { rank, vessel_type: vesselType, experience_tier, ship_specialisation, is_officer: isOfficer, mcq_count: mcqCount, total_questions: totalQuestions, interview_mode: interviewMode };

  await recordProbedClaims();

  return new Response(JSON.stringify(questions), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
