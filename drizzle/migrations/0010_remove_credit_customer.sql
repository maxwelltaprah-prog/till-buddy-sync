ALTER TABLE public.credit_customers ADD COLUMN IF NOT EXISTS removed_at timestamptz;

CREATE OR REPLACE FUNCTION public.remove_credit_customer(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid; v_balance numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can remove creditors';
  END IF;
  SELECT store_id INTO v_store FROM public.credit_customers WHERE id = p_id AND removed_at IS NULL;
  IF v_store IS NULL OR v_store IS DISTINCT FROM public.current_store_id() THEN
    RAISE EXCEPTION 'Creditor not found';
  END IF;
  SELECT COALESCE(SUM(amount - amount_paid), 0) INTO v_balance FROM public.credit_sales WHERE customer_id = p_id;
  IF v_balance > 0.001 THEN
    RAISE EXCEPTION 'This creditor still owes %. Record full payment before removing.', round(v_balance, 2);
  END IF;
  UPDATE public.credit_customers
     SET removed_at = now(), is_active = false, phone = NULL, email = NULL, address = NULL, id_number = NULL, notes = NULL, updated_at = now()
   WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION public.remove_credit_customer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_credit_customer(uuid) TO authenticated;