import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { creditStatus, daysToDue, type CreditStatus } from '@/lib/credit';
import { useAuth } from '@/contexts/AuthContext';
import { creditBranchScope } from '@/lib/creditBranch';

export interface CreditCustomer {
  id: string; name: string; phone: string | null; email: string | null; address: string | null;
  id_number: string | null; credit_limit: number; default_days: number; notes: string | null; is_active: boolean;
  branch_id: string | null;
}

export interface CreditSaleRow {
  id: string; sale_id: string; customer_id: string; branch_id: string; receipt_number: string;
  amount: number; amount_paid: number; repayment_days: number; due_date: string; created_at: string;
  customer?: { name: string; phone: string | null } | null;
}

export type CreditSaleWithStatus = CreditSaleRow & { status: CreditStatus; balance: number; days: number };

export function withStatus(rows: CreditSaleRow[], today = new Date()): CreditSaleWithStatus[] {
  return rows.map((r) => ({
    ...r,
    balance: Number(r.amount) - Number(r.amount_paid),
    status: creditStatus(Number(r.amount), Number(r.amount_paid), r.due_date, today),
    days: daysToDue(r.due_date, today),
  }));
}

/** Loads outstanding credit sales in the user's permitted branch scope. */
export function useOutstandingCredit() {
  const { hasRole, branch, store } = useAuth();
  const scope = creditBranchScope(hasRole('admin'), branch?.id);
  const [rows, setRows] = useState<CreditSaleWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setRows([]);
    setError(false);
    let query = supabase
      .from('credit_sales')
      .select('*, customer:credit_customers(name, phone)')
      .order('due_date', { ascending: true });
    if (scope) query = query.eq('branch_id', scope);
    const { data, error: e } = await query;
    if (e) setError(true);
    else setRows(withStatus((data as any) || []).filter((r) => r.status !== 'paid'));
    setIsLoading(false);
  }, [scope, store?.id]);

  useEffect(() => { load(); }, [load]);
  return { rows, isLoading, error, reload: load };
}
