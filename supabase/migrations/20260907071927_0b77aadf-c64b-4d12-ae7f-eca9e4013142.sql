ALTER TABLE public.interview_matrix ADD COLUMN IF NOT EXISTS overlay_kind text NOT NULL DEFAULT 'BASE';
ALTER TABLE public.interview_campaigns ADD COLUMN IF NOT EXISTS engine_types text[];
ALTER TABLE public.interview_pre_form ADD COLUMN IF NOT EXISTS engine_experience text[];

-- ── Cached question pools ──
CREATE TABLE IF NOT EXISTS public.interview_question_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_key text NOT NULL,
  tier text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS interview_question_pool_key ON public.interview_question_pool (spec_key, tier);
GRANT ALL ON public.interview_question_pool TO service_role;
ALTER TABLE public.interview_question_pool ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_manages_pool" ON public.interview_question_pool;
CREATE POLICY "service_role_manages_pool" ON public.interview_question_pool
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_pool_updated_at ON public.interview_question_pool;
CREATE TRIGGER trg_pool_updated_at BEFORE UPDATE ON public.interview_question_pool
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Matrix rows ──
INSERT INTO public.interview_matrix (department, rank_group, experience_tier, vessel_type, topics, scenario_weight, technical_weight, overlay_kind, notes) VALUES
 ('DECK','BOSUN','BASE',NULL,'["work planning","rigging supervision","deck maintenance","enclosed-space entry supervision","mooring team leadership","anchoring party"]',40,60,'BASE','rating sub-group'),
 ('DECK','AB','BASE',NULL,'["helm & lookout","mooring & snap-back zones","lifeboat & liferaft handling","pilot ladder rigging","cargo watch reporting","fire party duties"]',35,65,'BASE','rating sub-group'),
 ('DECK','OS','BASE',NULL,'["basic seamanship","PPE & safety equipment","watch reporting","housekeeping & hygiene","line handling under supervision"]',30,70,'BASE','rating sub-group'),
 ('ENGINE','FITTER','BASE',NULL,'["welding & hot work","machining & fitting","pipe fitting & flanges","lifting gear & rigging","pump overhaul assistance","spares & tools"]',35,65,'BASE','rating sub-group'),
 ('ENGINE','OILER','BASE',NULL,'["engine-room rounds & readings","purifier operation","bilge & OWS awareness","lube & fuel systems","alarm response","watch handover"]',35,65,'BASE','rating sub-group'),
 ('ENGINE','WIPER','BASE',NULL,'["engine-room safety & cleanliness","waste segregation","chemical handling","watch support"]',30,70,'BASE','rating sub-group'),
 ('ENGINE','PUMPMAN','BASE','TANKER_FAMILY','["cargo pumps & stripping","crude oil washing","inert gas","tank cleaning","hydraulics","gas measurement","cargo line-up"]',40,60,'BASE','rating sub-group'),
 ('ETO','ELECTRICIAN','BASE',NULL,'["motor & starter maintenance","switchboard & breaker safety","insulation testing & megger","lighting & distribution","battery & UPS systems","electrical permit to work","fault finding on control circuits"]',35,65,'BASE','rating sub-group'),
 ('CATERING','COOK','BASE',NULL,'["galley hygiene & HACCP","provisioning & stock rotation","menu planning for crew","galley fire safety","food allergies & special diets","potable water hygiene"]',30,70,'BASE','rating sub-group'),
 ('CATERING','STEWARD','BASE',NULL,'["accommodation hygiene","mess room service","laundry & linen handling","chemical handling & COSHH","waste segregation","assisting galley operations"]',30,70,'BASE','rating sub-group'),
 ('OFFSHORE','CRANE_OPERATOR','BASE',NULL,'["offshore crane operations & limits","load charts & dynamic factors","banksman signals & communication","lifting gear inspection","personnel transfer basket rules","crane maintenance & fault reporting"]',40,60,'BASE','rating sub-group')
ON CONFLICT (department, rank_group, experience_tier, vessel_type) DO NOTHING;

INSERT INTO public.interview_matrix (department, rank_group, experience_tier, vessel_type, topics, overlay_kind, notes) VALUES
 ('ALL','ANY','VESSEL','LPG','["reliquefaction plant & cargo compressors","semi-refrigerated & fully-refrigerated operation","ammonia & VCM handling","inhibited cargoes","gas detection","cargo tank pressure control"]','VESSEL','vessel overlay'),
 ('ALL','ANY','VESSEL','REEFER','["temperature & controlled-atmosphere logs","pre-cooling","cargo ventilation","reefer plant operation & alarms"]','VESSEL','vessel overlay'),
 ('ALL','ANY','VESSEL','RORO_PCTC','["lashing & securing","ramp & deck operations","free-surface stability","vehicle-deck fire risk & drencher systems"]','VESSEL','vessel overlay'),
 ('ALL','ANY','VESSEL','PASSENGER','["crowd management","damage stability","hotel-load power management"]','VESSEL','vessel overlay'),
 ('ALL','ANY','VESSEL','GENERAL_CARGO','["heavy-lift planning","cargo securing manual","hatch & crane operations"]','VESSEL','vessel overlay'),
 ('ALL','ANY','VESSEL','POLAR','["Polar Code requirements","Polar Water Operational Manual (PWOM)","ice navigation & escort","cold-weather equipment & winterisation"]','VESSEL','polar modifier'),
 ('ENGINE','ANY','VESSEL','BULK','["main-engine load management","ballast systems","hatch hydraulics","cargo gear power supply"]','VESSEL','vessel overlay'),
 ('ENGINE','ANY','VESSEL','CONTAINER','["main-engine load management","reefer power distribution","ballast systems","hatch hydraulics"]','VESSEL','vessel overlay')
ON CONFLICT (department, rank_group, experience_tier, vessel_type) DO NOTHING;

INSERT INTO public.interview_matrix (department, rank_group, experience_tier, vessel_type, topics, overlay_kind, notes) VALUES
 ('ENGINE','ANY','ENGINE_TECH','ME_C','["electronic control unit & hydraulic power supply","fuel injection timing & VIT equivalence","exhaust valve actuation","running modes & tuning","ME-C alarm handling & manual takeover"]','ENGINE_TECH','engine technology overlay'),
 ('ENGINE','ANY','ENGINE_TECH','MC','["camshaft & fuel pump timing","exhaust valve overhaul","mechanical governor & load control","scavenge fire prevention","liner & piston ring wear"]','ENGINE_TECH','engine technology overlay'),
 ('ENGINE','ANY','ENGINE_TECH','WINGD_X','["common rail fuel & servo oil system","WECS control system","RT-flex to X-series differences","starting air & reversing logic","pressure control valves maintenance"]','ENGINE_TECH','engine technology overlay'),
 ('ENGINE','ANY','ENGINE_TECH','DUAL_FUEL','["gas admission & safety interlocks","changeover procedures gas/liquid","double-wall piping & leak response","IGF Code requirements","gas valve unit maintenance","methane slip & knocking control"]','ENGINE_TECH','engine technology overlay'),
 ('ENGINE','ANY','ENGINE_TECH','TIER3','["SCR reactor operation & urea dosing","EGR blower & water treatment","NOx Technical File & Tier switching","ammonia slip control","Tier III record keeping"]','ENGINE_TECH','engine technology overlay'),
 ('ENGINE','ANY','ENGINE_TECH','SCRUBBER','["open/closed loop operation","wash-water monitoring & discharge criteria","sludge handling","bypass & fuel changeover","scrubber alarms & MARPOL Annex VI records"]','ENGINE_TECH','engine technology overlay'),
 ('ENGINE','ANY','ENGINE_TECH','SHAFT_GEN','["PTO/PTI operation & synchronising","frequency converter control","blackout risk during load transfer","shaft generator protection settings"]','ENGINE_TECH','engine technology overlay'),
 ('ENGINE','ANY','ENGINE_TECH','BATTERY','["battery room safety & ventilation","state of charge & peak shaving","hybrid power management modes","thermal runaway response"]','ENGINE_TECH','engine technology overlay'),
 ('ENGINE','ANY','ENGINE_TECH','ALT_FUEL','["methanol/ammonia fuel properties & toxicity","fuel preparation room requirements","leak detection & purging","IGF/IBC interface","PPE and emergency response for alternative fuels"]','ENGINE_TECH','engine technology overlay'),
 ('ENGINE','ANY','ENGINE_TECH','MEDIUM_SPEED','["four-stroke maintenance intervals","cylinder head & valve overhaul","turbocharger cleaning & surging","auxiliary engine load sharing","common rail medium-speed specifics"]','ENGINE_TECH','engine technology overlay'),
 ('ETO','ANY','ENGINE_TECH','ME_C','["ECU/CCU fault diagnosis","hydraulic power supply electrical control","sensor calibration & signal loops","software backup & parameter control"]','ENGINE_TECH','engine technology overlay'),
 ('ETO','ANY','ENGINE_TECH','MC','["governor & actuator electrics","alarm & monitoring loops","tacho & speed sensing","relay logic troubleshooting"]','ENGINE_TECH','engine technology overlay'),
 ('ETO','ANY','ENGINE_TECH','WINGD_X','["WECS modules & network","servo oil pump drives","sensor redundancy & voting","software diagnostics"]','ENGINE_TECH','engine technology overlay'),
 ('ETO','ANY','ENGINE_TECH','DUAL_FUEL','["gas safety loops & interlock testing","GVU electrical supervision","gas detection calibration","Ex equipment in gas zones"]','ENGINE_TECH','engine technology overlay'),
 ('ETO','ANY','ENGINE_TECH','TIER3','["urea dosing control loops","SCR temperature sensing","EGR control & feedback","NOx analyser maintenance"]','ENGINE_TECH','engine technology overlay'),
 ('ETO','ANY','ENGINE_TECH','SCRUBBER','["wash-water analyser maintenance","pump & valve control loops","data logging & reporting systems","scrubber PLC troubleshooting"]','ENGINE_TECH','engine technology overlay'),
 ('ETO','ANY','ENGINE_TECH','SHAFT_GEN','["frequency converter maintenance","synchronising & protection relays","harmonics & filters","PMS configuration for PTO"]','ENGINE_TECH','engine technology overlay'),
 ('ETO','ANY','ENGINE_TECH','BATTERY','["battery management system","DC switchboard protection","insulation monitoring on DC grids","thermal & gas detection in battery rooms"]','ENGINE_TECH','engine technology overlay'),
 ('ETO','ANY','ENGINE_TECH','ALT_FUEL','["Ex certification for fuel spaces","gas/vapour detection systems","emergency shutdown electrical chain","intrinsically safe maintenance practice"]','ENGINE_TECH','engine technology overlay'),
 ('ETO','ANY','ENGINE_TECH','MEDIUM_SPEED','["auxiliary engine control & load sharing","AVR and generator protection","safety shutdowns testing","engine monitoring sensors"]','ENGINE_TECH','engine technology overlay')
ON CONFLICT (department, rank_group, experience_tier, vessel_type) DO NOTHING;

INSERT INTO public.interview_matrix (department, rank_group, experience_tier, vessel_type, topics, overlay_kind, notes) VALUES
 ('ALL','OFFICERS','MODERN_REG',NULL,'["cyber risk management MSC.428(98)","EEXI/CII operational planning","ballast water management system operation","IGF Code","ECDIS anomalies & safety settings","scrubber discharge rules","MLC 2022 amendments"]','MODERN_REG','modern regulation overlay')
ON CONFLICT (department, rank_group, experience_tier, vessel_type) DO NOTHING;

-- ── Resolver v3 ──
CREATE OR REPLACE FUNCTION public.resolve_interview_spec_v3(
  p_rank text,
  p_years_in_rank numeric,
  p_contracts_in_rank integer,
  p_vessel text,
  p_specialist text DEFAULT NULL::text,
  p_cv_claims jsonb DEFAULT '[]'::jsonb,
  p_vacancy_topics jsonb DEFAULT '[]'::jsonb,
  p_engine_types jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dept text; v_group text; v_tier text; v_vessel_key text; v_specialist text;
  v_polar boolean := false; v_engine_keys text[] := '{}';
  v_raw text; v_txt text;
  base_topics jsonb; tier_row interview_matrix%ROWTYPE;
  vessel_topics jsonb := '[]'; spec_topics jsonb := '[]';
  engine_topics jsonb := '[]'; modern_topics jsonb := '[]';
  v_is_officer boolean;
BEGIN
  -- Department
  v_dept := CASE
    WHEN p_rank ~* 'eto|electro' THEN 'ETO'
    WHEN p_rank ~* 'electrician' THEN 'ETO'
    WHEN p_rank ~* 'cook|chef|steward|catering|mess' THEN 'CATERING'
    WHEN p_rank ~* 'engineer|motorman|oiler|fitter|wiper|pumpman' THEN 'ENGINE'
    WHEN p_rank ~* '\ydpo\y|rigger|roustabout|crane' THEN 'OFFSHORE'
    WHEN p_rank ~* 'bosun|boatswain|\yab\y|able seaman|able-bodied|\yos\y|ordinary seaman|deck boy' THEN 'DECK'
    ELSE 'DECK' END;

  -- Rating sub-groups first, then the classic management/operational logic
  v_group := CASE
    WHEN p_rank ~* 'pumpman' THEN 'PUMPMAN'
    WHEN p_rank ~* 'fitter' THEN 'FITTER'
    WHEN p_rank ~* 'oiler|motorman' THEN 'OILER'
    WHEN p_rank ~* 'wiper' THEN 'WIPER'
    WHEN p_rank ~* 'bosun|boatswain' THEN 'BOSUN'
    WHEN p_rank ~* '\yab\y|able seaman|able-bodied' THEN 'AB'
    WHEN p_rank ~* '\yos\y|ordinary seaman|deck boy' THEN 'OS'
    WHEN p_rank ~* 'electrician' AND p_rank !~* 'eto|electro-tech' THEN 'ELECTRICIAN'
    WHEN p_rank ~* 'steward|messman|mess boy' THEN 'STEWARD'
    WHEN p_rank ~* 'cook' AND p_rank !~* 'chief' THEN 'COOK'
    WHEN p_rank ~* 'crane' THEN 'CRANE_OPERATOR'
    WHEN p_rank ~* 'master|captain|chief officer|chief mate|chief engineer|2nd engineer|second engineer|1st engineer' THEN 'MANAGEMENT'
    WHEN p_rank ~* 'officer|mate|engineer|\ydpo\y|eto|electro' THEN 'OPERATIONAL'
    ELSE 'RATINGS' END;

  IF v_group = 'CRANE_OPERATOR' THEN v_dept := 'OFFSHORE'; END IF;
  IF v_group IN ('COOK','STEWARD') THEN v_dept := 'CATERING'; END IF;
  IF v_group = 'ELECTRICIAN' THEN v_dept := 'ETO'; END IF;
  IF v_group IN ('PUMPMAN','FITTER','OILER','WIPER') THEN v_dept := 'ENGINE'; END IF;
  IF v_group IN ('BOSUN','AB','OS') THEN v_dept := 'DECK'; END IF;

  v_is_officer := v_group IN ('MANAGEMENT','OPERATIONAL');

  v_tier := CASE
    WHEN coalesce(p_years_in_rank,0) >= 9 OR coalesce(p_contracts_in_rank,0) >= 12 THEN 'VETERAN'
    WHEN coalesce(p_years_in_rank,0) >= 5 OR coalesce(p_contracts_in_rank,0) >= 7 THEN 'SENIOR'
    WHEN coalesce(p_years_in_rank,0) >= 2 OR coalesce(p_contracts_in_rank,0) >= 3 THEN 'EXPERIENCED'
    ELSE 'DEVELOPING' END;

  v_vessel_key := CASE
    WHEN p_vessel ~* 'lpg|propane|butane|ammonia|vcm' THEN 'LPG'
    WHEN p_vessel ~* 'lng' THEN 'LNG'
    WHEN p_vessel ~* 'chem' THEN 'CHEM_TANKER'
    WHEN p_vessel ~* 'tanker|oil|product|crude|vlcc|aframax|suezmax' THEN 'OIL_TANKER'
    WHEN p_vessel ~* 'bulk|cape|panamax|handy' THEN 'BULK'
    WHEN p_vessel ~* 'container|teu|feeder' THEN 'CONTAINER'
    WHEN p_vessel ~* 'reefer|refrigerat' THEN 'REEFER'
    WHEN p_vessel ~* 'ro-?ro|pctc|car carrier|vehicle' THEN 'RORO_PCTC'
    WHEN p_vessel ~* 'cruise|passenger|ferry' THEN 'PASSENGER'
    WHEN p_vessel ~* 'general cargo|heavy lift|multipurpose|mpp' THEN 'GENERAL_CARGO'
    WHEN p_vessel ~* 'ahts|anchor' THEN 'AHTS'
    WHEN p_vessel ~* 'osv|psv|supply|dsv|offshore|wind|jack' THEN 'OSV'
    ELSE NULL END;

  v_polar := coalesce(p_vessel,'') ~* 'polar|ice class|arctic';

  v_specialist := CASE
    WHEN coalesce(p_specialist,'') ~* 'dpo' OR p_rank ~* '\ydpo\y' THEN 'DPO'
    WHEN coalesce(p_specialist,'') ~* 'chief cook' OR p_rank ~* 'chief cook|ch.?cook' THEN 'CHIEF_COOK'
    ELSE NULL END;

  -- Engine technology keys
  FOR v_raw IN SELECT jsonb_array_elements_text(coalesce(p_engine_types,'[]'::jsonb)) LOOP
    v_txt := coalesce(v_raw,'');
    IF v_txt ~* 'me-c|me-b|electronic' THEN v_engine_keys := array_append(v_engine_keys,'ME_C'); END IF;
    IF v_txt ~* '\ymc\y|camshaft' THEN v_engine_keys := array_append(v_engine_keys,'MC'); END IF;
    IF v_txt ~* 'wingd|x-?[0-9]{2}|rt-flex' THEN v_engine_keys := array_append(v_engine_keys,'WINGD_X'); END IF;
    IF v_txt ~* 'x-?df|me-gi|me-ga|dual' THEN v_engine_keys := array_append(v_engine_keys,'DUAL_FUEL'); END IF;
    IF v_txt ~* 'tier ?iii|scr|egr' THEN v_engine_keys := array_append(v_engine_keys,'TIER3'); END IF;
    IF v_txt ~* 'scrubber' THEN v_engine_keys := array_append(v_engine_keys,'SCRUBBER'); END IF;
    IF v_txt ~* 'shaft gen|pto' THEN v_engine_keys := array_append(v_engine_keys,'SHAFT_GEN'); END IF;
    IF v_txt ~* 'battery|hybrid' THEN v_engine_keys := array_append(v_engine_keys,'BATTERY'); END IF;
    IF v_txt ~* 'methanol|ammonia' THEN v_engine_keys := array_append(v_engine_keys,'ALT_FUEL'); END IF;
    IF v_txt ~* 'wartsila|mak|medium' THEN v_engine_keys := array_append(v_engine_keys,'MEDIUM_SPEED'); END IF;
  END LOOP;
  SELECT coalesce(array_agg(DISTINCT k),'{}') INTO v_engine_keys FROM unnest(v_engine_keys) k;

  -- Base topics: prefer a vessel-specific base row, else the generic one
  SELECT topics INTO base_topics FROM interview_matrix
    WHERE department=v_dept AND rank_group=v_group AND experience_tier='BASE'
    ORDER BY (vessel_type IS NULL) ASC LIMIT 1;
  IF base_topics IS NULL AND v_group NOT IN ('MANAGEMENT','OPERATIONAL') THEN
    SELECT topics INTO base_topics FROM interview_matrix
      WHERE department=v_dept AND rank_group='RATINGS' AND experience_tier='BASE' LIMIT 1;
  END IF;

  SELECT * INTO tier_row FROM interview_matrix
    WHERE department='ALL' AND experience_tier=v_tier LIMIT 1;

  SELECT coalesce(jsonb_agg(t),'[]'::jsonb) INTO vessel_topics FROM (
    SELECT jsonb_array_elements(topics) t FROM interview_matrix
    WHERE experience_tier='VESSEL'
      AND department IN ('ALL', v_dept)
      AND rank_group IN ('ANY', v_group)
      AND ( vessel_type = v_vessel_key
            OR (vessel_type='TANKER_FAMILY' AND v_vessel_key IN ('OIL_TANKER','CHEM_TANKER','LNG','LPG'))
            OR (v_polar AND vessel_type='POLAR') )) s;

  IF array_length(v_engine_keys,1) IS NOT NULL AND v_dept IN ('ENGINE','ETO') THEN
    SELECT coalesce(jsonb_agg(t),'[]'::jsonb) INTO engine_topics FROM (
      SELECT jsonb_array_elements(topics) t FROM interview_matrix
      WHERE experience_tier='ENGINE_TECH' AND department=v_dept
        AND vessel_type = ANY(v_engine_keys)) s;
  END IF;

  IF v_is_officer THEN
    SELECT topics INTO modern_topics FROM interview_matrix
      WHERE experience_tier='MODERN_REG' LIMIT 1;
  END IF;

  IF v_specialist IS NOT NULL THEN
    SELECT topics INTO spec_topics FROM interview_matrix
      WHERE department='SPECIALIST' AND rank_group=v_specialist LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'department', v_dept, 'rank_group', v_group, 'seniority', v_tier,
    'is_officer', v_is_officer,
    'vessel_family', coalesce(v_vessel_key,'GENERAL'),
    'polar', v_polar,
    'engine_keys', to_jsonb(v_engine_keys),
    'specialist', v_specialist,
    'scenario_weight', coalesce(tier_row.scenario_weight,40),
    'technical_weight', coalesce(tier_row.technical_weight,60),
    'ambiguity_level', CASE v_tier WHEN 'VETERAN' THEN 'high — layered, incomplete-information scenarios'
       WHEN 'SENIOR' THEN 'elevated' WHEN 'EXPERIENCED' THEN 'moderate' ELSE 'standard' END,
    'base_topics', coalesce(base_topics,'[]'::jsonb),
    'seniority_topics', coalesce(tier_row.topics,'[]'::jsonb),
    'vessel_topics', coalesce(vessel_topics,'[]'::jsonb),
    'engine_topics', coalesce(engine_topics,'[]'::jsonb),
    'modern_reg_topics', coalesce(modern_topics,'[]'::jsonb),
    'specialist_topics', coalesce(spec_topics,'[]'::jsonb),
    'cv_claims_to_verify', coalesce(p_cv_claims,'[]'::jsonb),
    'vacancy_requirements', coalesce(p_vacancy_topics,'[]'::jsonb),
    'spec_key', concat_ws('|', v_dept, v_group, coalesce(v_vessel_key,'GENERAL'),
        CASE WHEN v_polar THEN 'POLAR' ELSE '' END,
        coalesce(array_to_string(v_engine_keys,'+'),'')),
    'generation_note', 'Calibrate to the average competent holder of this rank on this vessel type. Seniority raises scenario ambiguity; technical evidence is ALWAYS verified. Claims and vacancy requirements MUST each produce at least one targeted question.');
END $function$;

GRANT EXECUTE ON FUNCTION public.resolve_interview_spec_v3(text, numeric, integer, text, text, jsonb, jsonb, jsonb) TO authenticated, service_role;

NOTIFY pgrst,'reload schema';