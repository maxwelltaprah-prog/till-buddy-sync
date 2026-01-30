-- Add INSERT policy for profiles - allows system/trigger to create profile
CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Add INSERT policy for user_roles - allows system/trigger to assign initial role
CREATE POLICY "System can assign initial role" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (user_id = auth.uid());