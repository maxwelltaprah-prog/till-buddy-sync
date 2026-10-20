import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TaxComponent } from '@/lib/tax';

export function useTaxComponents() {
  const [components, setComponents] = useState<TaxComponent[]>([]);
  const reload = async () => {
    const { data } = await supabase.from('tax_components').select('*').order('sort_order');
    setComponents((data as TaxComponent[]) || []);
  };
  useEffect(() => { reload(); }, []);
  return { components, reload };
}
