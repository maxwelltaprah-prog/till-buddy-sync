CREATE TABLE public.credit_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) DEFAULT public.current_store_id(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  id_number text,
  credit_limit numeric NOT NULL DEFAULT 0,
  default_days integer NOT NULL DEFAULT 30,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_customers TO authenticated;
GRANT ALL ON public.credit_customers TO service_role;
ALTER TABLE public.credit_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store isolation" ON public.credit_customers AS RESTRICTIVE FOR ALL TO public
  USING (store_id = public.current_store_id()) WITH CHECK (store_id = public.current_store_id());
CREATE POLICY "Staff view creditors" ON public.credit_customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sellers add creditors" ON public.credit_customers FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','cashier','branch_supervisor']::app_role[]));
CREATE POLICY "Managers edit creditors" ON public.credit_customers FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','branch_supervisor']::app_role[]));
CREATE POLICY "Admins delete creditors" ON public.credit_customers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.credit_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) DEFAULT public.current_store_id(),
  sale_id uuid NOT NULL REFERENCES public.sales(id),
  customer_id uuid NOT NULL REFERENCES public.credit_customers(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  receipt_number text NOT NULL,
  amount numeric NOT NULL,
  amount_paid numeric NOT NULL DEFAULT 0,
  repayment_days integer NOT NULL,
  due_date date NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.credit_sales TO authenticated;
GRANT ALL ON public.credit_sales TO service_role;
ALTER TABLE public.credit_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store isolation" ON public.credit_sales AS RESTRICTIVE FOR ALL TO public
  USING (store_id = public.current_store_id()) WITH CHECK (store_id = public.current_store_id());
CREATE POLICY "Staff view credit sales" ON public.credit_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sellers create credit sales" ON public.credit_sales FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','cashier','branch_supervisor']::app_role[]));

CREATE TABLE public.credit_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) DEFAULT public.current_store_id(),
  credit_sale_id uuid NOT NULL REFERENCES public.credit_sales(id),
  amount numeric NOT NULL CHECK (amount > 0),
  notes text,
  received_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.credit_payments TO authenticated;
GRANT ALL ON public.credit_payments TO service_role;
ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store isolation" ON public.credit_payments AS RESTRICTIVE FOR ALL TO public
  USING (store_id = public.current_store_id()) WITH CHECK (store_id = public.current_store_id());
CREATE POLICY "Staff view payments" ON public.credit_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sellers record payments" ON public.credit_payments FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','cashier','branch_supervisor']::app_role[]));

-- Keep amount_paid in sync; reject overpayment
CREATE OR REPLACE FUNCTION public.apply_credit_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal numeric;
BEGIN
  SELECT amount - amount_paid INTO bal FROM public.credit_sales WHERE id = NEW.credit_sale_id FOR UPDATE;
  IF NEW.amount > bal + 0.001 THEN RAISE EXCEPTION 'Payment exceeds outstanding balance'; END IF;
  UPDATE public.credit_sales SET amount_paid = amount_paid + NEW.amount WHERE id = NEW.credit_sale_id;
  RETURN NEW;
END $$;
CREATE TRIGGER apply_credit_payment AFTER INSERT ON public.credit_payments
FOR EACH ROW EXECUTE FUNCTION public.apply_credit_payment();

ALTER TABLE public.sales ADD COLUMN payment_method text NOT NULL DEFAULT 'cash';