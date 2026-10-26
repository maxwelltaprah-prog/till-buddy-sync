CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.platform_owners (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_owners TO authenticated;
GRANT ALL ON public.platform_owners TO service_role;
ALTER TABLE public.platform_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners see own row" ON public.platform_owners FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_platform_owner(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = _uid) $$;

ALTER TABLE public.profiles ADD COLUMN store_id uuid REFERENCES public.stores(id);

CREATE OR REPLACE FUNCTION public.current_store_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT store_id FROM public.profiles WHERE user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.user_store(_uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT store_id FROM public.profiles WHERE user_id = _uid $$;

-- Default store holds all existing data
INSERT INTO public.stores (id, name)
SELECT '00000000-0000-0000-0000-000000000001',
  COALESCE((SELECT value->>'shop_name' FROM public.system_settings WHERE key = 'shop_settings'), 'Main Store');
UPDATE public.profiles SET store_id = '00000000-0000-0000-0000-000000000001';
INSERT INTO public.platform_owners (user_id)
SELECT user_id FROM public.profiles WHERE lower(email) = 'maxwelltaprah@gmail.com'
ON CONFLICT DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_logs','branch_inventory','branches','bulk_pricing_tiers','categories','product_batches','products','return_items','returns','sale_items','sales','stock_movements','stock_transfers','suppliers','suspended_sales','system_settings','tax_components']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN store_id uuid REFERENCES public.stores(id) DEFAULT public.current_store_id()', t);
    EXECUTE format('UPDATE public.%I SET store_id = %L', t, '00000000-0000-0000-0000-000000000001');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN store_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX ON public.%I (store_id)', t);
    EXECUTE format('CREATE POLICY "Store isolation" ON public.%I AS RESTRICTIVE FOR ALL TO public USING (store_id = public.current_store_id()) WITH CHECK (store_id = public.current_store_id())', t);
  END LOOP;
END $$;

-- Per-store uniqueness
ALTER TABLE public.branches DROP CONSTRAINT branches_code_key, ADD CONSTRAINT branches_store_code_key UNIQUE (store_id, code);
ALTER TABLE public.suppliers DROP CONSTRAINT suppliers_code_key, ADD CONSTRAINT suppliers_store_code_key UNIQUE (store_id, code);
ALTER TABLE public.products DROP CONSTRAINT products_sku_key, ADD CONSTRAINT products_store_sku_key UNIQUE (store_id, sku);
ALTER TABLE public.products DROP CONSTRAINT products_barcode_key, ADD CONSTRAINT products_store_barcode_key UNIQUE (store_id, barcode);
ALTER TABLE public.system_settings DROP CONSTRAINT system_settings_key_key, ADD CONSTRAINT system_settings_store_key_key UNIQUE (store_id, key);
ALTER TABLE public.sales DROP CONSTRAINT sales_receipt_number_key, ADD CONSTRAINT sales_store_receipt_key UNIQUE (store_id, receipt_number);
ALTER TABLE public.returns DROP CONSTRAINT returns_return_number_key, ADD CONSTRAINT returns_store_number_key UNIQUE (store_id, return_number);

-- Profiles & roles isolation
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "System can assign initial role" ON public.user_roles;
CREATE POLICY "Store isolation" ON public.profiles AS RESTRICTIVE FOR ALL TO public
  USING (user_id = auth.uid() OR store_id = public.current_store_id())
  WITH CHECK (user_id = auth.uid() OR store_id = public.current_store_id());
CREATE POLICY "Store isolation" ON public.user_roles AS RESTRICTIVE FOR ALL TO public
  USING (user_id = auth.uid() OR public.user_store(user_id) = public.current_store_id())
  WITH CHECK (user_id <> auth.uid() AND public.user_store(user_id) = public.current_store_id());

CREATE OR REPLACE FUNCTION public.guard_profile_store()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_owner(auth.uid()) THEN
    IF TG_OP = 'INSERT' OR NEW.store_id IS DISTINCT FROM OLD.store_id THEN
      RAISE EXCEPTION 'Not allowed to change store';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_profile_store BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_store();

-- Stores policies
CREATE POLICY "Owners manage stores" ON public.stores FOR ALL TO authenticated
  USING (public.is_platform_owner(auth.uid())) WITH CHECK (public.is_platform_owner(auth.uid()));
CREATE POLICY "Members view own store" ON public.stores FOR SELECT TO authenticated
  USING (id = public.current_store_id());

-- New users: profile only; store & role are assigned by the server
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.create_branch_inventory_for_new_branch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.branch_inventory (branch_id, product_id, quantity, reserved_quantity, store_id)
  SELECT NEW.id, p.id, 0, 0, NEW.store_id FROM public.products p
  WHERE p.is_active = true AND p.store_id = NEW.store_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.create_branch_inventory_for_new_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.branch_inventory (branch_id, product_id, quantity, reserved_quantity, store_id)
  SELECT b.id, NEW.id, 0, 0, NEW.store_id FROM public.branches b
  WHERE b.is_active = true AND b.store_id = NEW.store_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

-- Owner enters a store
CREATE OR REPLACE FUNCTION public.switch_store(_store_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only the platform owner can switch stores';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id) THEN
    RAISE EXCEPTION 'Store not found';
  END IF;
  UPDATE public.profiles SET store_id = _store_id,
    branch_id = (SELECT id FROM public.branches WHERE store_id = _store_id ORDER BY created_at LIMIT 1)
  WHERE user_id = auth.uid();
END $$;
REVOKE EXECUTE ON FUNCTION public.switch_store(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.switch_store(uuid) TO authenticated;