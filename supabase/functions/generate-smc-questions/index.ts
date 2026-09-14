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
  // Poll requests (waiting for a pool that is still building) must never burn the rate limit.
  const isPoll = req.headers.get('x-pool-poll') === '1';

  const windowMs = 10 * 60 * 1000;
  const maxAttempts = 10;
  if (!isPoll) {
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

  // ── RECALL SEED ONLY (question_bank is a seed, never a whole paper) ──
  const rankGroup = isOfficer ? 'OFFICER' : 'RATING';
  const servedCount = isOfficer ? 15 : 12;
  const recallSeedTarget = Math.max(2, Math.round(servedCount * 0.3));
  const bankMCQ: any[] = [];
  {
    const { data: seeds } = await adminClient
      .from('question_bank')
      .select('*')
      .eq('rank_group', rankGroup)
      .eq('active', true)
      .order('times_used', { ascending: true })
      .limit(recallSeedTarget * 4);
    const picked = ((seeds as any[]) || []).sort(() => Math.random() - 0.5).slice(0, recallSeedTarget);
    for (const q of picked) {
      const options = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options as string[]);
      const correctAnswer = options[q.correct_index];
      const shuffledOptions = [...options].sort(() => Math.random() - 0.5);
      const newCorrectIndex = shuffledOptions.indexOf(correctAnswer);
      bankMCQ.push({
        id: q.id,
        domain: q.domain,
        level: 'recall',
        weight: 1.0,
        question: q.question,
        options: shuffledOptions,
        correct_index: newCorrectIndex,
        correct_letter: ['A','B','C','D'][newCorrectIndex],
        regulation: q.regulation,
        basis: q.regulation || 'established practice',
        explanation: q.explanation,
      });
      adminClient.from('question_bank').update({ times_used: (q.times_used || 0) + 1 }).eq('id', q.id);
    }
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

  // ── ENGINE / TECHNOLOGY CONTEXT (campaign or candidate pre-form) ──
  let engineTypes: string[] = [];
  try {
    if (_assessmentId) {
      const { data: prog } = await adminClient
        .from('interview_progress')
        .select('campaign_id')
        .eq('assessment_id', _assessmentId)
        .maybeSingle();
      if ((prog as any)?.campaign_id) {
        const { data: camp } = await adminClient
          .from('interview_campaigns')
          .select('engine_types')
          .eq('id', (prog as any).campaign_id)
          .maybeSingle();
        if (Array.isArray((camp as any)?.engine_types)) engineTypes = (camp as any).engine_types;
      }
      if (!engineTypes.length) {
        const { data: pre } = await adminClient
          .from('interview_pre_form')
          .select('engine_experience')
          .eq('assessment_id', _assessmentId)
          .maybeSingle();
        if (Array.isArray((pre as any)?.engine_experience)) engineTypes = (pre as any).engine_experience;
      }
    }
  } catch (_e) { /* engine context optional */ }

  // ── AI INTERVIEW V3 — RESOLVE INTERVIEW SPEC (never blocks) ──
  let spec: any = null;
  try {
    const { data: specData } = await adminClient.rpc('resolve_interview_spec_v3', {
      p_rank: rank,
      p_years_in_rank: yearsInRank ?? 2,
      p_contracts_in_rank: contractsInRank ?? 3,
      p_vessel: vesselType,
      p_specialist: null,
      p_cv_claims: cvClaims,
      p_vacancy_topics: [],
      p_engine_types: engineTypes,
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
Vessel topics: ${list(spec.vessel_topics).join('; ') || 'n/a'}${spec.polar ? ' (POLAR / ice-class operation applies)' : ''}
Engine technology topics (${list(spec.engine_keys).join(', ') || 'none declared'}): ${list(spec.engine_topics).join('; ') || 'n/a'}
Modern regulation topics: ${list(spec.modern_reg_topics).join('; ') || 'n/a'}
Specialist topics: ${list(spec.specialist_topics).join('; ') || 'n/a'}
Split of judgement vs hard-knowledge emphasis: scenario weight ${spec.scenario_weight}% / technical weight ${spec.technical_weight}%.
Scenario ambiguity level: ${spec.ambiguity_level}. ${String(spec.seniority) === 'VETERAN' ? 'Scenarios must be layered command situations with incomplete information, conflicting priorities and commercial pressure — but technical questions must STILL verify hard regulatory evidence.' : ''}
CV claims to verify (one targeted question each): ${list(spec.cv_claims_to_verify).join('; ') || 'none'}
Vacancy requirements (one targeted question each): ${list(spec.vacancy_requirements).join('; ') || 'none'}
Note: ${spec.generation_note || ''}
Apply this spec while keeping the exact question counts, difficulty scale and JSON output structure specified below.
` : '';

  // ── MCQ comes from the cached calibrated pool, never from the main call ──
  const needGptMCQ = false;

  // ── CALIBRATION DOCTRINE (identical for manager interviews and the crew SeaMinds Score) ──
  const tierCharacter: Record<string, string> = {
    JUNIOR: 'DEVELOPING — test procedures, correct order of steps and knowing when to call a senior.',
    MID: 'EXPERIENCED — realistic situations with one twist that changes the correct action.',
    SENIOR: 'SENIOR — prioritisation under conflicting operational, commercial and safety demands.',
    EXPERT: 'SENIOR — prioritisation under conflicting operational, commercial and safety demands.',
    COMMAND: 'VETERAN / COMMAND — command decisions, office pressure, crew management, PSC and vetting exposure.',
  };
  const rubric = `── CALIBRATION DOCTRINE (mandatory) ──
Question mix: exactly 30% recall, 50% application, 20% judgment. Mark each question with "level" ("recall" | "application" | "judgment") and "weight" (recall 1.0, application 1.25, judgment 1.5).
Pass reference: the AVERAGE COMPETENT holder of this rank on this vessel type — never the best officer in the fleet, never a textbook examiner.
Distractors: plausible misconceptions a weak but real candidate actually holds. Never silly, never two defensible answers, never trick wording or double negatives.
One skill per question. No compound questions.
Every question carries "basis": the regulation, manufacturer family or established practice it rests on. The basis is hidden from the candidate and shown only in the manager report.
Character of this paper: ${tierCharacter[experience_tier] || tierCharacter.MID}`;

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
${rubric}

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

  // ── CALIBRATED MCQ POOL (≥40 per rank/vessel/engine/tier, cached 90 days) ──
  const poolKey = `${spec?.spec_key || `${department}|${rank}|${ship_specialisation}`}`;
  const servePool = (pool: any[]) => {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const take = (lvl: string, n: number) => shuffled.filter((q) => q.level === lvl).slice(0, n);
    const recall = take('recall', Math.round(servedCount * 0.3));
    const application = take('application', Math.round(servedCount * 0.5));
    const judgment = take('judgment', Math.round(servedCount * 0.2));
    let picked = [...recall, ...application, ...judgment];
    if (picked.length < servedCount) {
      const ids = new Set(picked.map((q) => q.question));
      picked = [...picked, ...shuffled.filter((q) => !ids.has(q.question))].slice(0, servedCount);
    }
    return picked.sort(() => Math.random() - 0.5);
  };

  // ── LEVEL-LOCKED POOL BUILD: three separate calls, then a one-correct-answer validation pass ──
  const poolBase = userMessage.split('SECTION 2')[0];
  const LEVEL_WEIGHT: Record<string, number> = { recall: 1.0, application: 1.25, judgment: 1.5 };
  const isCommandTier = experience_tier === 'COMMAND' || experience_tier === 'SENIOR' || experience_tier === 'EXPERT';

  const vesselRealRule = `VESSEL-REAL REQUIREMENT (mandatory at this level):
Every question must present a CONCRETE operational situation on a ${vesselType || ship_specialisation} — with real numbers, equipment names, cargo names, port/terminal constraints, weather or time pressure drawn from the vessel type and the spec topics above (for example on bulk carriers: BLU Code loading sequences, shear force and bending moment limits, hold flooding and damage stability, cargo liquefaction / TML and moisture content, self-unloader or grab damage, hatch cover weathertight integrity, ballast water exchange under D-1/D-2).
FORBIDDEN at this level: any question of the form "what should you consider…", "which document…", "what is the definition of…", "which regulation covers…" — those are recall, not application or judgment. The candidate must choose an ACTION or a DECISION in a specific stated situation.`;

  const commandRule = `TIER CHARACTER — COMMAND/SENIOR: every question must be a command dilemma with a genuine trade-off — office/charterer pressure, terminal or berth-window pressure, PSC or vetting (SIRE/RightShip) exposure, or crew safety versus schedule. Never pure recall, never a definition.`;

  const levelSpec: Record<string, { n: number; instruction: string }> = {
    recall: {
      n: 12,
      instruction: `Generate exactly 12 RECALL questions: hard regulatory or technical facts the average competent ${rank} must know cold (limits, thresholds, required entries, mandatory equipment). Each must cite its basis.`,
    },
    application: {
      n: 20,
      instruction: `Generate exactly 20 APPLICATION questions.\n${vesselRealRule}${isCommandTier ? `\n${commandRule}` : ''}`,
    },
    judgment: {
      n: 8,
      instruction: `Generate exactly 8 JUDGMENT questions: layered situations with incomplete information and conflicting priorities where the competent ${rank} must decide what to do FIRST or which risk to accept.\n${vesselRealRule}${isCommandTier ? `\n${commandRule}` : ''}`,
    },
  };

  const logReject = async (reason: string, level: string, question: string) => {
    try {
      await adminClient.from('app_events').insert({
        event_type: 'question_rejected',
        message: reason,
        severity: 'warning',
        user_id: gate.userId,
        metadata: { level, rank, vessel_type: vesselType, spec_key: poolKey, tier: experience_tier, question: (question || '').slice(0, 400) },
      });
    } catch (_e) { /* logging must never block generation */ }
  };

  const shapeOk = (q: any) =>
    q && typeof q.question === 'string' && q.question.trim().length > 15 &&
    Array.isArray(q.options) && q.options.length === 4 &&
    Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index <= 3;

  const RECALL_FORMS = /^(what should you consider|which document|what is the definition|which regulation)/i;

  const callLevel = async (level: string, want: number): Promise<any[]> => {
    const prompt = `${poolBase}

${levelSpec[level].instruction}

EVERY question in this response must have "level":"${level}". Do not emit any other level.
Each question has exactly 4 options (A–D) and EXACTLY ONE defensibly correct answer for a competent ${rank}. Distractors must be real misconceptions, never absurd, never a second defensible answer.
Return ONLY valid JSON: {"pool":[{"id":"q1","domain":"safety|security|management|technical|watchkeeping","level":"${level}","weight":${LEVEL_WEIGHT[level]},"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correct_index":0,"correct_letter":"A","basis":"regulation, manufacturer family or established practice","regulation":"...","explanation":"..."}]}`;
    const t = Date.now();
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
        max_tokens: 8000,
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });
    const d = await r.json();
    await meterAi(adminClient, { userId: gate.userId, feature: `generate-smc-questions-pool-${level}`, model: "gpt-4o-mini", usage: d?.usage, success: r.ok, latencyMs: Date.now() - t });
    let parsed: any = {};
    try { parsed = JSON.parse((d.choices?.[0]?.message?.content || '{}').replace(/```json|```/g, '').trim()); } catch { parsed = {}; }
    const raw: any[] = Array.isArray(parsed.pool) ? parsed.pool : (Array.isArray(parsed.mcq) ? parsed.mcq : []);
    const kept: any[] = [];
    for (const q of raw) {
      if (!shapeOk(q)) { await logReject('malformed question discarded', level, q?.question || ''); continue; }
      if (String(q.level || '').toLowerCase() !== level) { await logReject(`level tag mismatch — model returned "${q.level}" for the ${level} call`, level, q.question); continue; }
      if (level !== 'recall' && RECALL_FORMS.test(q.question.trim())) { await logReject('recall-shaped question returned at application/judgment level', level, q.question); continue; }
      kept.push({ ...q, level, weight: LEVEL_WEIGHT[level], correct_letter: ['A', 'B', 'C', 'D'][q.correct_index], basis: q.basis || q.regulation || 'established practice' });
    }
    return kept.slice(0, want);
  };

  // Second cheap pass: exactly one defensibly correct option?
  const validateBatch = async (batch: any[]): Promise<any[]> => {
    if (!batch.length) return [];
    const listing = batch.map((q, i) => `#${i + 1} Q: ${q.question}\nOptions: ${q.options.join(' | ')}\nMarked correct: ${q.options[q.correct_index]}`).join('\n\n');
    const t = Date.now();
    let verdicts: any[] = [];
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a maritime examination moderator. For each question decide: is exactly one option defensibly correct for a competent seafarer of the stated rank, and is the marked answer that option? Answer YES or NO with a short reason. Return ONLY JSON." },
            { role: "user", content: `Rank: ${rank}. Vessel: ${vesselType || ship_specialisation}.\n\n${listing}\n\nReturn {"verdicts":[{"n":1,"answer":"YES|NO","reason":"..."}]} for every question.` },
          ],
          max_tokens: 3000,
          temperature: 0,
          response_format: { type: "json_object" },
        }),
      });
      const d = await r.json();
      await meterAi(adminClient, { userId: gate.userId, feature: "generate-smc-questions-validate", model: "gpt-4o-mini", usage: d?.usage, success: r.ok, latencyMs: Date.now() - t });
      const parsed = JSON.parse((d.choices?.[0]?.message?.content || '{}').replace(/```json|```/g, '').trim());
      verdicts = Array.isArray(parsed?.verdicts) ? parsed.verdicts : [];
    } catch (_e) {
      return batch; // validation failure must never empty the paper
    }
    if (!verdicts.length) return batch;
    const bad = new Map<number, string>();
    for (const v of verdicts) {
      if (String(v?.answer || '').toUpperCase().startsWith('N')) bad.set(Number(v?.n), String(v?.reason || 'not exactly one defensible answer'));
    }
    const passed: any[] = [];
    for (let i = 0; i < batch.length; i++) {
      const reason = bad.get(i + 1);
      if (reason) await logReject(`validator NO — ${reason}`, batch[i].level, batch[i].question);
      else passed.push(batch[i]);
    }
    return passed;
  };

  const buildLevel = async (level: string): Promise<any[]> => {
    const want = levelSpec[level].n;
    let out: any[] = [];
    for (let attempt = 0; attempt < 3 && out.length < want; attempt++) {
      const fresh = await callLevel(level, want - out.length);
      const validated = await validateBatch(fresh);
      const seen = new Set(out.map((q) => q.question.trim().toLowerCase()));
      for (const q of validated) {
        const k = q.question.trim().toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(q);
      }
    }
    return out.slice(0, want);
  };

  const buildPool = async (): Promise<any[]> => {
    const [recall, application, judgment] = await Promise.all([
      buildLevel('recall'),
      buildLevel('application'),
      buildLevel('judgment'),
    ]);
    const pool = [...recall, ...application, ...judgment].map((q, i) => ({ ...q, id: q.id || `q${i + 1}` }));
    if (pool.length) {
      await adminClient.from('interview_question_pool').upsert(
        { spec_key: poolKey, tier: experience_tier, questions: pool, updated_at: new Date().toISOString(), created_at: new Date().toISOString() },
        { onConflict: 'spec_key,tier' },
      );
    }
    console.log(`pool built: ${pool.length}/40 (recall ${recall.length}, application ${application.length}, judgment ${judgment.length})`);
    return pool;
  };

  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const { data: cached } = await adminClient
      .from('interview_question_pool')
      .select('questions, created_at')
      .eq('spec_key', poolKey)
      .eq('tier', experience_tier)
      .gte('created_at', cutoff)
      .maybeSingle();
    let pool: any[] = Array.isArray((cached as any)?.questions) ? (cached as any).questions : [];
    if (pool.length < 40) pool = await buildPool();
    if (pool.length) {
      const served = servePool(pool);
      questions.mcq = served.length ? served : bankMCQ;
    } else if (bankMCQ.length) {
      questions.mcq = bankMCQ;
    }
  } catch (_e) {
    if (bankMCQ.length) questions.mcq = bankMCQ;
  }

  // ── LEGACY BANK PATH (kept as final fallback) ──
  if (Array.isArray(questions.mcq) && questions.mcq.length) {
    // pool already served
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
  questions.candidate_context = { rank, vessel_type: vesselType, experience_tier, ship_specialisation, is_officer: isOfficer, mcq_count: (questions.mcq || []).length || mcqCount, total_questions: totalQuestions, interview_mode: interviewMode, engine_types: engineTypes, spec_key: spec?.spec_key || null, rank_group: spec?.rank_group || null, vessel_family: spec?.vessel_family || null, level_mix: { recall: 30, application: 50, judgment: 20 } };

  await recordProbedClaims();

  return new Response(JSON.stringify(questions), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
