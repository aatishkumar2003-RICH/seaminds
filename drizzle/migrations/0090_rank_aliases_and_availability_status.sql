INSERT INTO public.rank_taxonomy (rank_pattern, canonical_rank, department, department_label, rank_group, level)
SELECT a.alias, t.canonical_rank, t.department, t.department_label, t.rank_group, t.level
FROM (VALUES
 ('2nd off','2nd Officer'),('2 o','2nd Officer'),('2nd mate','2nd Officer'),('second off','2nd Officer'),('second mate','2nd Officer'),
 ('3rd off','3rd Officer'),('3 o','3rd Officer'),('3rd mate','3rd Officer'),('third off','3rd Officer'),('third mate','3rd Officer'),
 ('c o','Chief Officer'),('chief off','Chief Officer'),('1st mate','Chief Officer'),('first mate','Chief Officer'),
 ('c e','Chief Engineer'),('2 e','2nd Engineer'),('3 e','3rd Engineer'),('4 e','4th Engineer'),
 ('2nd eng','2nd Engineer'),('3rd eng','3rd Engineer'),('4th eng','4th Engineer'),('chief eng','Chief Engineer'),
 ('eeo','ETO'),('ab seaman','Able Seaman'),('mess man','Messman')
) a(alias, canon)
JOIN LATERAL (SELECT * FROM public.rank_taxonomy r WHERE r.canonical_rank = a.canon LIMIT 1) t ON true
WHERE NOT EXISTS (SELECT 1 FROM public.rank_taxonomy x WHERE x.rank_pattern = a.alias);

ALTER TABLE public.crew_profiles ADD COLUMN IF NOT EXISTS availability_status text;

CREATE OR REPLACE FUNCTION public.sync_availability_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.availability_status IS NOT NULL AND NEW.availability_status NOT IN ('ready','joined','not_available') THEN
    RAISE EXCEPTION 'INVALID_AVAILABILITY_STATUS';
  END IF;
  IF NEW.availability_status IS DISTINCT FROM OLD.availability_status AND NEW.availability_status IS NOT NULL THEN
    NEW.is_available := (NEW.availability_status = 'ready');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_availability_status ON public.crew_profiles;
CREATE TRIGGER trg_sync_availability_status BEFORE UPDATE ON public.crew_profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_availability_status();
NOTIFY pgrst, 'reload schema';