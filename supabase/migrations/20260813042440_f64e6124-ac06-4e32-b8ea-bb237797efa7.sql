CREATE TABLE IF NOT EXISTS public.interview_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  seq int NOT NULL,
  question text NOT NULL,
  question_type text,
  is_followup boolean NOT NULL DEFAULT false,
  answer text NOT NULL,
  ai_score numeric,
  red_flag boolean DEFAULT false,
  red_flag_category text,
  matrix_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, seq)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_answers TO authenticated;
GRANT ALL ON public.interview_answers TO service_role;

CREATE INDEX IF NOT EXISTS idx_interview_answers_assessment ON public.interview_answers (assessment_id, seq);

ALTER TABLE public.interview_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crew_manages_own_answers" ON public.interview_answers;
CREATE POLICY "crew_manages_own_answers" ON public.interview_answers FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.smc_assessments a WHERE a.id = assessment_id AND a.crew_profile_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.smc_assessments a WHERE a.id = assessment_id AND a.crew_profile_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.scoring_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT ALL ON public.scoring_jobs TO service_role;

CREATE INDEX IF NOT EXISTS idx_scoring_jobs_due ON public.scoring_jobs (status, next_attempt_at);

ALTER TABLE public.scoring_jobs ENABLE ROW LEVEL SECURITY;