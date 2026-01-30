-- Create atomic sale creation function to prevent receipt number duplicates
CREATE OR REPLACE FUNCTION public.create_sale_with_receipt(
  p_branch_id UUID,
  p_branch_code TEXT,
  p_cashier_id UUID,
  p_subtotal NUMERIC,
  p_discount_amount NUMERIC,
  p_tax_amount NUMERIC,
  p_total NUMERIC,
  p_cash_received NUMERIC,
  p_change_given NUMERIC
)
RETURNS TABLE(sale_id UUID, receipt_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_date TEXT;
  v_seq_num INTEGER;
  v_receipt TEXT;
  v_sale_id UUID;
BEGIN
  v_today_date := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Use advisory lock to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext(p_branch_code || v_today_date));
  
  -- Get next sequence number
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(s.receipt_number FROM LENGTH(p_branch_code) + 10) AS INTEGER)
  ), -1) + 1
  INTO v_seq_num
  FROM public.sales s
  WHERE s.receipt_number LIKE p_branch_code || '-' || v_today_date || '-%';
  
  -- Generate receipt number
  v_receipt := p_branch_code || '-' || v_today_date || '-' || LPAD(v_seq_num::TEXT, 5, '0');
  
  -- Insert sale record atomically
  INSERT INTO public.sales (
    receipt_number,
    branch_id,
    cashier_id,
    subtotal,
    discount_amount,
    tax_amount,
    total,
    cash_received,
    change_given,
    status
  ) VALUES (
    v_receipt,
    p_branch_id,
    p_cashier_id,
    p_subtotal,
    p_discount_amount,
    p_tax_amount,
    p_total,
    p_cash_received,
    p_change_given,
    'completed'
  )
  RETURNING id INTO v_sale_id;
  
  RETURN QUERY SELECT v_sale_id, v_receipt;
END;
$$;