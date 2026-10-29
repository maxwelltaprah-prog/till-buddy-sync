CREATE OR REPLACE FUNCTION public.deduct_sale_item_stock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sale public.sales%ROWTYPE; v_available numeric; v_reserved numeric;
BEGIN
 SELECT * INTO v_sale FROM public.sales WHERE id=NEW.sale_id FOR UPDATE;
 IF NOT FOUND OR v_sale.store_id IS DISTINCT FROM NEW.store_id THEN RAISE EXCEPTION 'Sale item must belong to its sale store'; END IF;
 IF auth.uid() IS NOT NULL THEN
  IF public.current_store_id() IS DISTINCT FROM NEW.store_id OR NOT public.has_any_role(auth.uid(), ARRAY['admin','cashier']::public.app_role[]) THEN RAISE EXCEPTION 'Not authorized to sell this stock'; END IF;
  IF NOT public.has_role(auth.uid(), 'admin') AND (v_sale.cashier_id IS DISTINCT FROM auth.uid() OR v_sale.branch_id IS DISTINCT FROM public.get_user_branch(auth.uid())) THEN RAISE EXCEPTION 'Sales must use your assigned outlet'; END IF;
 END IF;
 IF NEW.quantity IS NULL OR NEW.quantity <= 0 OR NEW.quantity::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Sale quantity must be positive and finite'; END IF;
 IF v_sale.status IS DISTINCT FROM 'completed'::public.transaction_status THEN RAISE EXCEPTION 'Stock can only be sold on completed sales'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.products WHERE id=NEW.product_id AND store_id=NEW.store_id) THEN RAISE EXCEPTION 'Product is not in this store'; END IF;
 SELECT quantity, reserved_quantity INTO v_available, v_reserved FROM public.branch_inventory WHERE store_id=NEW.store_id AND branch_id=v_sale.branch_id AND product_id=NEW.product_id AND is_available FOR UPDATE;
 IF NOT FOUND OR COALESCE(v_available,0)-COALESCE(v_reserved,0) < NEW.quantity THEN RAISE EXCEPTION 'Insufficient stock at this outlet'; END IF;
 UPDATE public.branch_inventory SET quantity=quantity-NEW.quantity WHERE store_id=NEW.store_id AND branch_id=v_sale.branch_id AND product_id=NEW.product_id;
 INSERT INTO public.stock_movements(store_id,branch_id,product_id,operation_type,quantity,reference_id,reference_type,performed_by) VALUES(NEW.store_id,v_sale.branch_id,NEW.product_id,'sale',-NEW.quantity,NEW.sale_id,'sale',v_sale.cashier_id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.deduct_sale_item_stock() FROM PUBLIC;
CREATE TRIGGER deduct_stock_on_sale_item AFTER INSERT ON public.sale_items FOR EACH ROW EXECUTE FUNCTION public.deduct_sale_item_stock();