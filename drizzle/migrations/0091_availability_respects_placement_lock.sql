CREATE OR REPLACE FUNCTION public.sync_availability_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.availability_status IS NOT NULL AND NEW.availability_status NOT IN ('ready','joined','not_available') THEN
    RAISE EXCEPTION 'INVALID_AVAILABILITY_STATUS';
  END IF;
  IF NEW.availability_status IS DISTINCT FROM OLD.availability_status AND NEW.availability_status IS NOT NULL THEN
    NEW.is_available := (NEW.availability_status = 'ready');
  END IF;
  IF NEW.placed_until IS NOT NULL AND NEW.placed_until > current_date THEN
    NEW.is_available := false;
  END IF;
  RETURN NEW;
END $$;