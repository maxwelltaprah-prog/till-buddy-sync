
-- Function to auto-create branch inventory for new products
CREATE OR REPLACE FUNCTION public.create_branch_inventory_for_new_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.branch_inventory (branch_id, product_id, quantity, reserved_quantity)
  SELECT b.id, NEW.id, 0, 0
  FROM public.branches b
  WHERE b.is_active = true
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger on product insert
CREATE TRIGGER create_inventory_on_product_insert
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.create_branch_inventory_for_new_product();

-- Also create a function for when a new branch is added (inventory for all existing products)
CREATE OR REPLACE FUNCTION public.create_branch_inventory_for_new_branch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.branch_inventory (branch_id, product_id, quantity, reserved_quantity)
  SELECT NEW.id, p.id, 0, 0
  FROM public.products p
  WHERE p.is_active = true
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger on branch insert
CREATE TRIGGER create_inventory_on_branch_insert
AFTER INSERT ON public.branches
FOR EACH ROW
EXECUTE FUNCTION public.create_branch_inventory_for_new_branch();

-- Backfill: create missing inventory records for existing products/branches
INSERT INTO public.branch_inventory (branch_id, product_id, quantity, reserved_quantity)
SELECT b.id, p.id, 0, 0
FROM public.branches b
CROSS JOIN public.products p
WHERE b.is_active = true AND p.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM public.branch_inventory bi
  WHERE bi.branch_id = b.id AND bi.product_id = p.id
)
ON CONFLICT DO NOTHING;
