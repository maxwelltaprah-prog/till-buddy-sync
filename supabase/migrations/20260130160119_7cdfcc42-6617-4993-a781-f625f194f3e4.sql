-- Fix generate_receipt_number with proper locking to prevent duplicates
CREATE OR REPLACE FUNCTION public.generate_receipt_number(branch_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  today_date TEXT;
  seq_num INTEGER;
  receipt TEXT;
BEGIN
  today_date := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Use advisory lock for this specific branch and date to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext(branch_code || today_date));
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(receipt_number FROM LENGTH(branch_code) + 10) AS INTEGER)
  ), -1) + 1
  INTO seq_num
  FROM public.sales
  WHERE receipt_number LIKE branch_code || '-' || today_date || '-%';
  
  receipt := branch_code || '-' || today_date || '-' || LPAD(seq_num::TEXT, 5, '0');
  RETURN receipt;
END;
$$;