CREATE OR REPLACE FUNCTION public.sync_store_name_from_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF NEW.key = 'shop_settings' THEN
    v_name := btrim(NEW.value->>'shop_name');
    IF v_name IS NOT NULL AND v_name <> '' THEN
      UPDATE public.stores SET name = v_name, updated_at = now() WHERE id = NEW.store_id AND name IS DISTINCT FROM v_name;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_store_name_from_settings() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS sync_store_name_from_settings ON public.system_settings;
CREATE TRIGGER sync_store_name_from_settings AFTER INSERT OR UPDATE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.sync_store_name_from_settings();
UPDATE public.stores s SET name = btrim(ss.value->>'shop_name'), updated_at = now()
FROM public.system_settings ss
WHERE ss.store_id = s.id AND ss.key = 'shop_settings' AND coalesce(btrim(ss.value->>'shop_name'),'') <> '' AND s.name <> btrim(ss.value->>'shop_name');