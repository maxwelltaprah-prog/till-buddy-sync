-- Create a trigger to auto-assign admin role to the first user
-- and auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
  default_role app_role;
BEGIN
  -- Count existing profiles (not the current one being created)
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  -- First user becomes admin, subsequent users become cashiers by default
  IF user_count = 0 THEN
    default_role := 'admin';
  ELSE
    default_role := 'cashier';
  END IF;
  
  -- Create profile
  INSERT INTO public.profiles (user_id, email, full_name, branch_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    '11111111-1111-1111-1111-111111111111' -- Default to Main Store
  );
  
  -- Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, default_role);
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();