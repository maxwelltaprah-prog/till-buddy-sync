ALTER TABLE public.credit_customers ADD COLUMN branch_id uuid REFERENCES public.branches(id) DEFAULT public.get_user_branch(auth.uid());
CREATE INDEX credit_customers_branch_idx ON public.credit_customers(store_id, branch_id);
UPDATE public.credit_customers c SET branch_id = x.branch_id FROM (SELECT customer_id, min(branch_id::text)::uuid AS branch_id FROM public.credit_sales GROUP BY customer_id HAVING count(DISTINCT branch_id)=1) x WHERE x.customer_id=c.id;
CREATE POLICY "Creditor branch isolation" ON public.credit_customers AS RESTRICTIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR branch_id = public.get_user_branch(auth.uid()) OR EXISTS (SELECT 1 FROM public.credit_sales s WHERE s.customer_id = credit_customers.id AND s.branch_id = public.get_user_branch(auth.uid()))) WITH CHECK (public.has_role(auth.uid(), 'admin') OR branch_id = public.get_user_branch(auth.uid()));
CREATE POLICY "Credit sale branch isolation" ON public.credit_sales AS RESTRICTIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR branch_id = public.get_user_branch(auth.uid())) WITH CHECK (public.has_role(auth.uid(), 'admin') OR branch_id = public.get_user_branch(auth.uid()));
CREATE POLICY "Payment branch isolation" ON public.credit_payments AS RESTRICTIVE FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.credit_sales s WHERE s.id = credit_payments.credit_sale_id AND s.store_id = credit_payments.store_id AND (public.has_role(auth.uid(), 'admin') OR s.branch_id = public.get_user_branch(auth.uid())))) WITH CHECK (EXISTS (SELECT 1 FROM public.credit_sales s WHERE s.id = credit_payments.credit_sale_id AND s.store_id = credit_payments.store_id AND (public.has_role(auth.uid(), 'admin') OR s.branch_id = public.get_user_branch(auth.uid()))));
CREATE OR REPLACE FUNCTION public.guard_credit_branch_links() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_TABLE_NAME = 'credit_customers' THEN
  IF NEW.branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id=NEW.branch_id AND b.store_id=NEW.store_id) THEN RAISE EXCEPTION 'Creditor branch must belong to the same store'; END IF;
 ELSE
  IF NOT EXISTS (SELECT 1 FROM public.sales s WHERE s.id=NEW.sale_id AND s.store_id=NEW.store_id AND s.branch_id=NEW.branch_id) THEN RAISE EXCEPTION 'Credit sale must match the original sale branch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.credit_customers c WHERE c.id=NEW.customer_id AND c.store_id=NEW.store_id AND (public.has_role(auth.uid(), 'admin') OR c.branch_id=NEW.branch_id OR EXISTS (SELECT 1 FROM public.credit_sales cs WHERE cs.customer_id=c.id AND cs.branch_id=NEW.branch_id AND cs.store_id=NEW.store_id))) THEN RAISE EXCEPTION 'Select a creditor assigned to this branch'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_credit_customer_branch BEFORE INSERT OR UPDATE ON public.credit_customers FOR EACH ROW EXECUTE FUNCTION public.guard_credit_branch_links();
CREATE TRIGGER guard_credit_sale_branch BEFORE INSERT ON public.credit_sales FOR EACH ROW EXECUTE FUNCTION public.guard_credit_branch_links();