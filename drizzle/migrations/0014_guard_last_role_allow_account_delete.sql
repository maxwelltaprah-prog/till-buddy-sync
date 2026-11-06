CREATE OR REPLACE FUNCTION public.guard_last_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Deleting the whole account cascades here from a foreign key (nested trigger): allow it.
  IF pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.user_id AND id <> OLD.id) THEN
    RAISE EXCEPTION 'An account must keep at least one role';
  END IF;
  RETURN OLD;
END $$;