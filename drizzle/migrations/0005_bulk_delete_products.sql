CREATE OR REPLACE FUNCTION public.bulk_delete_products(p_ids uuid[])
RETURNS TABLE(deleted integer, deactivated integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid := public.current_store_id(); v_del uuid[]; v_keep uuid[];
BEGIN
  IF v_store IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can delete products';
  END IF;
  SELECT array_agg(id) FILTER (WHERE NOT used), array_agg(id) FILTER (WHERE used)
    INTO v_del, v_keep
  FROM (SELECT p.id, (EXISTS (SELECT 1 FROM sale_items s WHERE s.product_id = p.id)
                   OR EXISTS (SELECT 1 FROM return_items r WHERE r.product_id = p.id)) AS used
        FROM products p WHERE p.id = ANY(p_ids) AND p.store_id = v_store) x;
  IF v_del IS NOT NULL THEN
    DELETE FROM bulk_pricing_tiers WHERE product_id = ANY(v_del);
    DELETE FROM product_batches WHERE product_id = ANY(v_del);
    DELETE FROM stock_movements WHERE product_id = ANY(v_del);
    DELETE FROM stock_transfers WHERE product_id = ANY(v_del);
    DELETE FROM branch_inventory WHERE product_id = ANY(v_del);
    DELETE FROM products WHERE id = ANY(v_del);
  END IF;
  IF v_keep IS NOT NULL THEN
    UPDATE products SET is_active = false WHERE id = ANY(v_keep);
  END IF;
  RETURN QUERY SELECT coalesce(array_length(v_del,1),0), coalesce(array_length(v_keep,1),0);
END $$;
REVOKE ALL ON FUNCTION public.bulk_delete_products(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_delete_products(uuid[]) TO authenticated;