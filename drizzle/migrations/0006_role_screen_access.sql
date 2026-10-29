CREATE TABLE public.role_screen_access (
 store_id uuid NOT NULL DEFAULT public.current_store_id() REFERENCES public.stores(id),
 role public.app_role NOT NULL CHECK (role <> 'admin'),
 screen text NOT NULL CHECK (screen IN ('/pos','/dashboard','/products','/categories','/inventory','/stock-movements','/stock-transfers','/expiry','/bulk-import','/suppliers','/returns','/creditors','/reports','/profit')),
 enabled boolean NOT NULL,
 PRIMARY KEY (store_id, role, screen)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_screen_access TO authenticated;
GRANT ALL ON public.role_screen_access TO service_role;
ALTER TABLE public.role_screen_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store isolation" ON public.role_screen_access AS RESTRICTIVE FOR ALL TO authenticated USING (store_id = public.current_store_id()) WITH CHECK (store_id = public.current_store_id());
CREATE POLICY "Read screen settings" ON public.role_screen_access FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage screen settings" ON public.role_screen_access FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));