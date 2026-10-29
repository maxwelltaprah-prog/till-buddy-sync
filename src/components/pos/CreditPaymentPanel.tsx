import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrency } from '@/hooks/useCurrency';
import { addDays, creditStatus } from '@/lib/credit';
import type { CreditCustomer } from '@/hooks/useCreditAccounts';
import { AlertTriangle, Plus, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { creditBranchScope } from '@/lib/creditBranch';

export interface CreditSelection {
  customer: CreditCustomer | null;
  days: number;
  dueDate: string;
  /** Reason the sale cannot proceed on credit, if any. */
  blocker: string | null;
}

interface Props {
  total: number;
  onChange: (s: CreditSelection) => void;
}

const DAY_OPTIONS = [7, 14, 30, 60, 90];

export function CreditPaymentPanel({ total, onChange }: Props) {
  const { hasRole, branch, store } = useAuth();
  const scope = creditBranchScope(hasRole('admin'), branch?.id);
  const { formatPrice } = useCurrency();
  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [outstanding, setOutstanding] = useState<Record<string, { balance: number; overdue: number }>>({});
  const [customerId, setCustomerId] = useState('');
  const [days, setDays] = useState(30);
  const [adding, setAdding] = useState(false);
  const [newC, setNewC] = useState({ name: '', phone: '', address: '' });
  const [search, setSearch] = useState('');

  const load = async () => {
    setCustomers([]); setOutstanding({}); setCustomerId('');
    let salesQuery = supabase.from('credit_sales').select('customer_id, amount, amount_paid, due_date');
    if (scope) salesQuery = salesQuery.eq('branch_id', scope);
    const [c, s] = await Promise.all([
      supabase.from('credit_customers').select('*').eq('is_active', true).order('name'),
      salesQuery,
    ]);
    setCustomers((c.data as any) || []);
    const map: Record<string, { balance: number; overdue: number }> = {};
    (s.data || []).forEach((r: any) => {
      const bal = Number(r.amount) - Number(r.amount_paid);
      if (bal <= 0.001) return;
      const m = (map[r.customer_id] ??= { balance: 0, overdue: 0 });
      m.balance += bal;
      if (creditStatus(Number(r.amount), Number(r.amount_paid), r.due_date) === 'overdue') m.overdue += bal;
    });
    setOutstanding(map);
  };
  useEffect(() => { load(); }, [scope, store?.id]);

  const customer = customers.find((c) => c.id === customerId) || null;
  const dueDate = addDays(new Date(), days);
  const info = customer ? outstanding[customer.id] : undefined;

  const blocker = useMemo(() => {
    if (!customer) return 'Select a creditor';
    const limit = Number(customer.credit_limit) || 0;
    if (limit > 0 && (info?.balance || 0) + total > limit + 0.001) {
      return `Credit limit of ${formatPrice(limit)} would be exceeded`;
    }
    return null;
  }, [customer, info, total, formatPrice]);

  useEffect(() => { onChange({ customer, days, dueDate, blocker }); }, [customer, days, dueDate, blocker]);

  const filtered = customers.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search));

  const create = async () => {
    if (!branch?.id) { toast.error('Select an assigned branch before adding a creditor'); return; }
    if (newC.name.trim().length < 2 || newC.phone.trim().length < 6) {
      toast.error('Enter the creditor’s name and phone number');
      return;
    }
    const { data, error } = await supabase.from('credit_customers')
      .insert({ branch_id: branch.id, name: newC.name.trim(), phone: newC.phone.trim(), address: newC.address.trim() || null })
      .select('*').single();
    if (error) { toast.error(error.message); return; }
    setCustomers((cs) => [...cs, data as any].sort((a, b) => a.name.localeCompare(b.name)));
    setCustomerId(data.id);
    setAdding(false);
    setNewC({ name: '', phone: '', address: '' });
  };

  return (
    <div className="space-y-4">
      {!adding ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Creditor</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" />New creditor
            </Button>
          </div>
          <Input placeholder="Search name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={customerId} onValueChange={(v) => {
            setCustomerId(v);
            const c = customers.find((x) => x.id === v);
            if (c?.default_days) setDays(c.default_days);
          }}>
            <SelectTrigger><SelectValue placeholder={customers.length ? 'Choose a creditor' : 'No creditors yet — add one'} /></SelectTrigger>
            <SelectContent>
              {filtered.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">New creditor</p>
          <Input placeholder="Full name *" value={newC.name} onChange={(e) => setNewC({ ...newC, name: e.target.value })} />
          <Input placeholder="Phone *" value={newC.phone} onChange={(e) => setNewC({ ...newC, phone: e.target.value })} />
          <Input placeholder="Address" value={newC.address} onChange={(e) => setNewC({ ...newC, address: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={create}>Save creditor</Button>
          </div>
        </div>
      )}

      {customer && (
        <div className="space-y-1 rounded-lg bg-muted/60 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium"><UserRound className="h-4 w-4" />{customer.name}</div>
          <div className="flex justify-between text-muted-foreground"><span>Outstanding</span><span>{formatPrice(info?.balance || 0)}</span></div>
          {Number(customer.credit_limit) > 0 && (
            <div className="flex justify-between text-muted-foreground"><span>Credit limit</span><span>{formatPrice(Number(customer.credit_limit))}</span></div>
          )}
          {info && info.overdue > 0 && (
            <div className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="h-4 w-4" />{formatPrice(info.overdue)} is already overdue
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>Repayment period</Label>
        <div className="flex flex-wrap gap-2">
          {DAY_OPTIONS.map((d) => (
            <Button key={d} type="button" size="sm" variant={days === d ? 'default' : 'outline'} onClick={() => setDays(d)}>{d} days</Button>
          ))}
          <Input type="number" min={1} max={365} className="w-24" value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(365, parseInt(e.target.value || '1', 10))))} />
        </div>
        <p className="text-sm text-muted-foreground">Repay by <Badge variant="secondary">{dueDate}</Badge></p>
      </div>

      {blocker && customer && <p className="text-sm text-destructive">{blocker}</p>}
    </div>
  );
}
