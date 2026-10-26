ALTER TABLE public.stores ADD COLUMN archived_at timestamptz;
CREATE OR REPLACE FUNCTION public.current_store_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p.store_id FROM public.profiles p JOIN public.stores s ON s.id=p.store_id WHERE p.user_id=auth.uid() AND (public.is_platform_owner(auth.uid()) OR (s.is_active AND s.archived_at IS NULL))
$$;
CREATE OR REPLACE FUNCTION public.switch_store(_store_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_platform_owner(auth.uid()) THEN RAISE EXCEPTION 'Only the platform owner can switch stores'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id=_store_id AND is_active AND archived_at IS NULL) THEN RAISE EXCEPTION 'Store is inactive, archived or not found'; END IF;
 UPDATE public.profiles SET store_id=_store_id, branch_id=(SELECT id FROM public.branches WHERE store_id=_store_id ORDER BY created_at LIMIT 1) WHERE user_id=auth.uid();
END $$;
CREATE OR REPLACE FUNCTION public.guard_sale_store_access() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL THEN
  IF public.current_store_id() IS NULL OR NEW.store_id IS DISTINCT FROM public.current_store_id() THEN RAISE EXCEPTION 'Store access is unavailable'; END IF;
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','cashier','branch_supervisor']::public.app_role[]) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id=NEW.branch_id AND store_id=NEW.store_id) THEN RAISE EXCEPTION 'Branch is not in this store'; END IF;
  IF TG_OP='INSERT' AND NEW.cashier_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Invalid cashier'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_sale_store_access BEFORE INSERT OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.guard_sale_store_access();
CREATE OR REPLACE FUNCTION public.guard_transfer_store_access() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND (public.current_store_id() IS NULL OR NEW.store_id IS DISTINCT FROM public.current_store_id() OR NOT EXISTS (SELECT 1 FROM public.branches WHERE id=NEW.from_branch_id AND store_id=NEW.store_id) OR NOT EXISTS (SELECT 1 FROM public.branches WHERE id=NEW.to_branch_id AND store_id=NEW.store_id) OR NOT EXISTS (SELECT 1 FROM public.products WHERE id=NEW.product_id AND store_id=NEW.store_id)) THEN RAISE EXCEPTION 'Store access is unavailable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_transfer_store_access BEFORE INSERT ON public.stock_transfers FOR EACH ROW EXECUTE FUNCTION public.guard_transfer_store_access();