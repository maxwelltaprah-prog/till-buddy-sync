-- Role changes go only through the manage-users function; browsers can read but never write roles.
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Never leave a signed-in account without any role (cascade deletes of the auth user still work).
CREATE OR REPLACE FUNCTION public.guard_last_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id)
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.user_id AND id <> OLD.id) THEN
    RAISE EXCEPTION 'An account must keep at least one role';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS guard_last_user_role ON public.user_roles;
CREATE TRIGGER guard_last_user_role BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_last_user_role();

-- Definitive store status for the signed-in user, unaffected by row visibility rules.
CREATE OR REPLACE FUNCTION public.my_store_status()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN s.id IS NULL THEN 'none'
    WHEN s.archived_at IS NOT NULL THEN 'archived'
    WHEN NOT s.is_active THEN 'inactive'
    ELSE 'active' END
  FROM public.profiles p LEFT JOIN public.stores s ON s.id = p.store_id
  WHERE p.user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.my_store_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_store_status() TO authenticated;
REVOKE ALL ON FUNCTION public.guard_last_user_role() FROM PUBLIC, anon, authenticated;