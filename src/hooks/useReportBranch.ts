import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ALL_REPORT_BRANCHES, resolveReportBranch } from '@/lib/reportBranch';
import { toast } from 'sonner';

export function useReportBranch() {
  const { branch, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [selectedBranch, setSelectedBranch] = useState(ALL_REPORT_BRANCHES);
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    supabase.from('branches').select('id, name, code').order('name').then(({ data, error }) => {
      if (!active) return;
      if (error) toast.error('Failed to load report branches');
      else setBranches(data || []);
    });
    return () => { active = false; };
  }, [isAdmin]);

  const branchId = resolveReportBranch(isAdmin, selectedBranch, branch?.id ?? null);
  const branchName = isAdmin
    ? branches.find((b) => b.id === selectedBranch)?.name ?? 'All branches'
    : branch?.name ?? 'No branch assigned';

  return { isAdmin, selectedBranch, setSelectedBranch, branches, branchId, branchName, canView: isAdmin || Boolean(branchId) };
}