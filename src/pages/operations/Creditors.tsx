import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaginationBar, usePagination } from '@/components/PaginationBar';
import { EmptyState, ErrorState, TableLoadingRows, TableStateRow, CardsLoading } from '@/components/states';
import { withStatus, type CreditCustomer, type CreditSaleWithStatus } from '@/hooks/useCreditAccounts';
import { CREDIT_STATUS_LABEL, CREDIT_WARN_DAYS, type CreditStatus } from '@/lib/credit';
import { HandCoins, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';

const statusClass: Record<CreditStatus, string> = {
  paid: 'bg-success/15 text-success',
  current: 'bg-muted text-muted-foreground',
  due_soon: 'bg-warning/20 text-warning',
  due_today: 'bg-warning/30 text-warning',
  overdue: 'bg-destructive/15 text-destructive',
};

const emptyCustomer = { name: '', phone: '', email: '', address: '', id_number: '', credit_limit: '', default_days: '30', notes: '' };

export default function Creditors() {
  const { hasAnyRole } = useAuth();
  const { formatPrice } = useCurrency();
  const canEdit = hasAnyRole(['admin', 'branch_supervisor']);
  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [sales, setSales] = useState<CreditSaleWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<'open' | 'overdue' | 'due' | 'all'>('open');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CreditCustomer | null>(null);
  const [form, setForm] = useState(emptyCustomer);
  const [showCustomer, setShowCustomer] = useState(false);
  const [paying, setPaying] = useState<CreditSaleWithStatus | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setLoadError(false);
    const [c, s] = await Promise.all([
      supabase.from('credit_customers').select('*').order('name'),
      supabase.from('credit_sales').select('*, customer:credit_customers(name, phone)').order('due_date'),
    ]);
    if (c.error || s.error) setLoadError(true);
    else {
      setCustomers((c.data as any) || []);
      setSales(withStatus((s.data as any) || []));
    }
    setIsLoading(false);
  };
  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const open = sales.filter((s) => s.status !== 'paid');
    const sum = (xs: CreditSaleWithStatus[]) => xs.reduce((a, s) => a + s.balance, 0);
    return {
      outstanding: sum(open),
      overdue: sum(open.filter((s) => s.status === 'overdue')),
      dueSoon: sum(open.filter((s) => s.status === 'due_soon' || s.status === 'due_today')),
      count: open.length,
    };
  }, [sales]);

  const visibleSales = useMemo(() => sales.filter((s) => {
    if (filter === 'open' && s.status === 'paid') return false;
    if (filter === 'overdue' && s.status !== 'overdue') return false;
    if (filter === 'due' && s.status !== 'due_soon' && s.status !== 'due_today') return false;
    const q = search.toLowerCase();
    return !q || (s.customer?.name || '').toLowerCase().includes(q) || s.receipt_number.toLowerCase().includes(q);
  }), [sales, filter, search]);

  const customerBalances = useMemo(() => {
    const m: Record<string, number> = {};
    sales.forEach((s) => { if (s.status !== 'paid') m[s.customer_id] = (m[s.customer_id] || 0) + s.balance; });
    return m;
  }, [sales]);

  const salesPg = usePagination(visibleSales);
  const custPg = usePagination(customers.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)));

  const openCustomer = (c?: CreditCustomer) => {
    setEditing(c ?? null);
    setForm(c ? {
      name: c.name, phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '', id_number: c.id_number ?? '',
      credit_limit: String(c.credit_limit ?? ''), default_days: String(c.default_days ?? 30), notes: c.notes ?? '',
    } : emptyCustomer);
    setShowCustomer(true);
  };

  const saveCustomer = async () => {
    if (form.name.trim().length < 2 || form.phone.trim().length < 6) { toast.error('Name and phone number are required'); return; }
    const payload = {
      name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() || null, address: form.address.trim() || null,
      id_number: form.id_number.trim() || null, credit_limit: Number(form.credit_limit) || 0,
      default_days: Math.max(1, parseInt(form.default_days || '30', 10)), notes: form.notes.trim() || null,
    };
    setBusy(true);
    const { error } = editing
      ? await supabase.from('credit_customers').update(payload).eq('id', editing.id)
      : await supabase.from('credit_customers').insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? 'Creditor updated' : 'Creditor added');
    setShowCustomer(false);
    load();
  };

  const recordPayment = async () => {
    if (!paying) return;
    const amt = Number(payAmount);
    if (!(amt > 0)) { toast.error('Enter an amount'); return; }
    if (amt > paying.balance + 0.001) { toast.error(`Amount is more than the balance of ${formatPrice(paying.balance)}`); return; }
    setBusy(true);
    const { error } = await supabase.from('credit_payments').insert({ credit_sale_id: paying.id, amount: amt, notes: payNotes.trim() || null });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Repayment recorded');
    setPaying(null); setPayAmount(''); setPayNotes('');
    load();
  };

  const set = (k: keyof typeof emptyCustomer) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Creditors</h1>
          <p>Customers buying on credit, what they owe and when it's due. Alerts start {CREDIT_WARN_DAYS} days before the repayment date.</p>
        </div>
        <Button onClick={() => openCustomer()}><Plus className="mr-2 h-4 w-4" />Add creditor</Button>
      </div>

      {isLoading ? <CardsLoading /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Outstanding', formatPrice(totals.outstanding), ''],
            ['Overdue', formatPrice(totals.overdue), 'text-destructive'],
            [`Due within ${CREDIT_WARN_DAYS} days`, formatPrice(totals.dueSoon), 'text-warning'],
            ['Open credit sales', String(totals.count), ''],
          ].map(([l, v, c]) => (
            <Card key={l}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{l}</CardTitle></CardHeader>
              <CardContent><p className={`text-2xl font-bold ${c}`}>{v}</p></CardContent></Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="sales">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="sales">Credit sales</TabsTrigger>
            <TabsTrigger value="customers">Creditor list</TabsTrigger>
          </TabsList>
          <Input placeholder="Search name, phone or receipt" className="w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <TabsContent value="sales" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {([['open', 'Unpaid'], ['overdue', 'Overdue'], ['due', 'Due soon'], ['all', 'All']] as const).map(([k, l]) => (
              <Button key={k} size="sm" variant={filter === k ? 'default' : 'outline'} onClick={() => setFilter(k)}>{l}</Button>
            ))}
          </div>
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Creditor</TableHead><TableHead>Receipt</TableHead><TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead>
                <TableHead>Due date</TableHead><TableHead>Status</TableHead><TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {isLoading ? <TableLoadingRows cols={8} /> : loadError ? (
                  <TableStateRow cols={8}><ErrorState title="Couldn't load credit sales" onRetry={load} /></TableStateRow>
                ) : salesPg.pageItems.length === 0 ? (
                  <TableStateRow cols={8}><EmptyState icon={HandCoins} title={sales.length ? 'Nothing in this view' : 'No credit sales yet'} description={sales.length ? 'Try another filter.' : 'Choose "Credit" at the POS checkout to sell to a creditor.'} /></TableStateRow>
                ) : salesPg.pageItems.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><div className="font-medium">{s.customer?.name}</div><div className="text-xs text-muted-foreground">{s.customer?.phone}</div></TableCell>
                    <TableCell className="font-mono text-sm">{s.receipt_number}</TableCell>
                    <TableCell className="text-right">{formatPrice(Number(s.amount))}</TableCell>
                    <TableCell className="text-right">{formatPrice(Number(s.amount_paid))}</TableCell>
                    <TableCell className="text-right font-semibold">{formatPrice(s.balance)}</TableCell>
                    <TableCell>
                      <div>{s.due_date}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.status === 'paid' ? `${s.repayment_days} days` : s.days < 0 ? `${-s.days} days late` : s.days === 0 ? 'today' : `in ${s.days} days`}
                      </div>
                    </TableCell>
                    <TableCell><Badge className={statusClass[s.status]} variant="secondary">{CREDIT_STATUS_LABEL[s.status]}</Badge></TableCell>
                    <TableCell className="text-right">
                      {s.status !== 'paid' && <Button size="sm" variant="outline" onClick={() => { setPaying(s); setPayAmount(s.balance.toFixed(2)); }}>Record payment</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar {...salesPg} />
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Address</TableHead>
                <TableHead className="text-right">Credit limit</TableHead><TableHead className="text-right">Default days</TableHead>
                <TableHead className="text-right">Owes</TableHead><TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {isLoading ? <TableLoadingRows cols={7} /> : loadError ? (
                  <TableStateRow cols={7}><ErrorState title="Couldn't load creditors" onRetry={load} /></TableStateRow>
                ) : custPg.pageItems.length === 0 ? (
                  <TableStateRow cols={7}><EmptyState icon={Users} title="No creditors yet" description="Add the people or businesses you allow to buy on credit." action={<Button size="sm" onClick={() => openCustomer()}><Plus className="mr-2 h-4 w-4" />Add creditor</Button>} /></TableStateRow>
                ) : custPg.pageItems.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}{!c.is_active && <Badge variant="outline" className="ml-2">Inactive</Badge>}</TableCell>
                    <TableCell>{c.phone ?? '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{c.address ?? '—'}</TableCell>
                    <TableCell className="text-right">{Number(c.credit_limit) > 0 ? formatPrice(Number(c.credit_limit)) : 'No limit'}</TableCell>
                    <TableCell className="text-right">{c.default_days}</TableCell>
                    <TableCell className="text-right font-semibold">{formatPrice(customerBalances[c.id] || 0)}</TableCell>
                    <TableCell className="text-right">{canEdit && <Button size="sm" variant="ghost" onClick={() => openCustomer(c)}>Edit</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar {...custPg} />
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showCustomer} onOpenChange={setShowCustomer}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit creditor' : 'Add creditor'}</DialogTitle>
            <DialogDescription>Details used at the POS when selling on credit.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1"><Label>Full name *</Label><Input value={form.name} onChange={set('name')} /></div>
            <div className="space-y-1"><Label>Phone *</Label><Input value={form.phone} onChange={set('phone')} /></div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={set('email')} /></div>
            <div className="col-span-2 space-y-1"><Label>Address</Label><Input value={form.address} onChange={set('address')} /></div>
            <div className="space-y-1"><Label>Ghana Card / ID no.</Label><Input value={form.id_number} onChange={set('id_number')} /></div>
            <div className="space-y-1"><Label>Credit limit (0 = none)</Label><Input type="number" min="0" value={form.credit_limit} onChange={set('credit_limit')} /></div>
            <div className="space-y-1"><Label>Default repayment days</Label><Input type="number" min="1" value={form.default_days} onChange={set('default_days')} /></div>
            <div className="col-span-2 space-y-1"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={set('notes')} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomer(false)}>Cancel</Button>
            <Button onClick={saveCustomer} disabled={busy}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record repayment</DialogTitle>
            <DialogDescription>{paying?.customer?.name} · {paying?.receipt_number} · balance {paying && formatPrice(paying.balance)}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Amount received</Label><Input type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
            <div className="space-y-1"><Label>Notes</Label><Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="e.g. Mobile money" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>Cancel</Button>
            <Button onClick={recordPayment} disabled={busy}>Save payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
