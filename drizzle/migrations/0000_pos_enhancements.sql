ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shelf_life_days integer;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS tax_breakdown jsonb;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tax_breakdown jsonb;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS location_type text NOT NULL DEFAULT 'sales_point';
ALTER TABLE public.branch_inventory ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

CREATE TABLE public.tax_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_components TO authenticated;
GRANT ALL ON public.tax_components TO service_role;
ALTER TABLE public.tax_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read taxes" ON public.tax_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage taxes" ON public.tax_components FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.tax_components (name, code, rate, description, sort_order) VALUES
('VAT (Value Added Tax)','VAT',15.0,'Applied to the taxable subtotal',1),
('NHIL (National Health Insurance Levy)','NHIL',2.5,'Calculated on the taxable subtotal',2),
('GETFund Levy (Ghana Education Trust Fund)','GETFUND',2.5,'Calculated on the taxable subtotal',3);

CREATE TABLE public.product_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number text,
  mfg_date date,
  expiry_date date,
  quantity numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_batches TO authenticated;
GRANT ALL ON public.product_batches TO service_role;
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read batches" ON public.product_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Stock manage batches" ON public.product_batches FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','stock_manager']::app_role[])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','stock_manager']::app_role[]));

CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_branch_id uuid NOT NULL REFERENCES public.branches(id),
  to_branch_id uuid NOT NULL REFERENCES public.branches(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity numeric NOT NULL,
  notes text,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stock_transfers TO authenticated;
GRANT ALL ON public.stock_transfers TO service_role;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read transfers" ON public.stock_transfers FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.transfer_stock(p_from uuid, p_to uuid, p_product uuid, p_qty numeric, p_notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_avail numeric; v_id uuid;
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY['admin','stock_manager']::app_role[]) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  IF p_from = p_to THEN RAISE EXCEPTION 'Source and destination must differ'; END IF;
  SELECT quantity INTO v_avail FROM branch_inventory WHERE branch_id=p_from AND product_id=p_product FOR UPDATE;
  IF COALESCE(v_avail,0) < p_qty THEN RAISE EXCEPTION 'Insufficient stock (available %)', COALESCE(v_avail,0); END IF;
  UPDATE branch_inventory SET quantity = quantity - p_qty WHERE branch_id=p_from AND product_id=p_product;
  INSERT INTO branch_inventory (branch_id, product_id, quantity, reserved_quantity) VALUES (p_to, p_product, p_qty, 0)
  ON CONFLICT (branch_id, product_id) DO UPDATE SET quantity = branch_inventory.quantity + p_qty, last_restocked_at = now();
  INSERT INTO stock_transfers (from_branch_id,to_branch_id,product_id,quantity,notes,performed_by)
  VALUES (p_from,p_to,p_product,p_qty,p_notes,auth.uid()) RETURNING id INTO v_id;
  INSERT INTO stock_movements (branch_id,product_id,operation_type,quantity,reference_id,reference_type,reason,performed_by) VALUES
  (p_from,p_product,'transfer_out',-p_qty,v_id,'transfer',p_notes,auth.uid()),
  (p_to,p_product,'transfer_in',p_qty,v_id,'transfer',p_notes,auth.uid());
  RETURN v_id;
END $$;

INSERT INTO public.system_settings (key, value, description)
VALUES ('expiry_ageing', '{"t1":3,"t2":4,"t3":6}'::jsonb, 'Expiry ageing thresholds in months')
ON CONFLICT (key) DO NOTHING;