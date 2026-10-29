CREATE POLICY "Cashiers view assigned branch credit transactions"
ON public.sales FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'cashier'::public.app_role)
  AND store_id = public.current_store_id()
  AND branch_id = public.get_user_branch(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.credit_sales cs
    WHERE cs.sale_id = sales.id
      AND cs.store_id = sales.store_id
      AND cs.branch_id = sales.branch_id
  )
);