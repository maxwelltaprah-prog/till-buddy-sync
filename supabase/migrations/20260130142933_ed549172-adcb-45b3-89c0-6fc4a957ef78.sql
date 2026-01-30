-- Fix the overly permissive audit_logs INSERT policy
-- This policy should only allow authenticated users to insert their own logs

DROP POLICY IF EXISTS "Audit logs insertable by all authenticated" ON public.audit_logs;

CREATE POLICY "Audit logs insertable by authenticated users" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);