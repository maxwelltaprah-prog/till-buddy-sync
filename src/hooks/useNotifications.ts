import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { daysUntil } from '@/lib/expiry';
import { withStatus } from '@/hooks/useCreditAccounts';
import { creditBranchScope } from '@/lib/creditBranch';

/** Batches expiring within this many days raise a notification. */
export const EXPIRY_NOTICE_DAYS = 30;

export interface AppNotification {
  id: string;
  kind: 'expired' | 'expiring' | 'credit_overdue' | 'credit_due';
  title: string;
  detail: string;
  link: string;
  severity: 'critical' | 'warning';
}

export function useNotifications() {
  const { user, branch, hasRole } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isAdmin = hasRole('admin');

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setItems([]);
    const limit = new Date();
    limit.setDate(limit.getDate() + EXPIRY_NOTICE_DAYS);
    const limitStr = limit.toISOString().slice(0, 10);

    let bq = supabase.from('product_batches')
      .select('id, expiry_date, quantity, batch_number, product:products(name), branch:branches(name)')
      .gt('quantity', 0).not('expiry_date', 'is', null).lte('expiry_date', limitStr)
      .order('expiry_date').limit(100);
    if (!isAdmin && branch?.id) bq = bq.eq('branch_id', branch.id);

    let cq = supabase.from('credit_sales').select('*, customer:credit_customers(name, phone)').order('due_date').limit(300);
    const creditScope = creditBranchScope(isAdmin, branch?.id);
    if (creditScope) cq = cq.eq('branch_id', creditScope);

    const [b, c] = await Promise.all([bq, cq]);
    const out: AppNotification[] = [];

    (b.data || []).forEach((x: any) => {
      const d = daysUntil(x.expiry_date) ?? 0;
      const name = x.product?.name ?? 'Product';
      out.push({
        id: `b-${x.id}`,
        kind: d < 0 ? 'expired' : 'expiring',
        severity: d < 0 ? 'critical' : 'warning',
        title: d < 0 ? `${name} has expired` : `${name} expires in ${d} day${d === 1 ? '' : 's'}`,
        detail: `${Number(x.quantity)} units · ${x.branch?.name ?? ''}${x.batch_number ? ` · batch ${x.batch_number}` : ''} · ${x.expiry_date}`,
        link: '/expiry',
      });
    });

    withStatus((c.data as any) || []).forEach((r) => {
      if (r.status === 'paid' || r.status === 'current') return;
      const who = r.customer?.name ?? 'Creditor';
      out.push({
        id: `c-${r.id}`,
        kind: r.status === 'overdue' ? 'credit_overdue' : 'credit_due',
        severity: r.status === 'overdue' ? 'critical' : 'warning',
        title: r.status === 'overdue'
          ? `${who}'s credit is ${-r.days} day${r.days === -1 ? '' : 's'} overdue`
          : r.status === 'due_today' ? `${who}'s credit is due today` : `${who}'s credit is due in ${r.days} day${r.days === 1 ? '' : 's'}`,
        detail: `Receipt ${r.receipt_number} · balance ${r.balance.toFixed(2)} · due ${r.due_date}`,
        link: '/creditors',
      });
    });

    out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1));
    setItems(out);
    setIsLoading(false);
  }, [user, branch?.id, isAdmin]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  return { items, isLoading, reload: load };
}
