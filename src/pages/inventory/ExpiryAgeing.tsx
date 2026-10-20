import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaginationBar, usePagination } from '@/components/PaginationBar';
import { toast } from 'sonner';
import { Plus, Save } from 'lucide-react';
import { ageBucket, bucketLabel, daysUntil, DEFAULT_THRESHOLDS, type AgeBucket, type AgeingThresholds } from '@/lib/expiry';

interface Batch {
  id: string; branch_id: string; product_id: string; batch_number: string | null;
  mfg_date: string | null; expiry_date: string | null; quantity: number;
  product?: { name: string; sku: string; shelf_life_days: number | null };
  branch?: { name: string };
}

const bucketClass: Record<AgeBucket, string> = {
  expired: 'bg-destructive text-destructive-foreground',
  b1: 'bg-destructive/15 text-destructive',
  b2: 'bg-warning/20 text-warning',
  b3: 'bg-accent/20 text-accent-foreground',
  safe: 'bg-success/15 text-success',
  none: 'bg-muted text-muted-foreground',
};

export default function ExpiryAgeing() {
  const { user, hasRole } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [th, setTh] = useState<AgeingThresholds>(DEFAULT_THRESHOLDS);
  const [filter, setFilter] = useState<AgeBucket | 'all'>('all');
  const [products, setProducts] = useState<{ id: string; name: string; shelf_life_days: number | null }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ product_id: '', branch_id: '', batch_number: '', mfg_date: '', expiry_date: '', quantity: '' });

  const load = async () => {
    const [b, s, p, br] = await Promise.all([
      supabase.from('product_batches').select('*, product:products(name, sku, shelf_life_days), branch:branches(name)').gt('quantity', 0).order('expiry_date', { ascending: true }),
      supabase.from('system_settings').select('value').eq('key', 'expiry_ageing').maybeSingle(),
      supabase.from('products').select('id, name, shelf_life_days').eq('is_active', true).order('name'),
      supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
    ]);
    setBatches((b.data as any) || []);
    if (s.data?.value) setTh({ ...DEFAULT_THRESHOLDS, ...(s.data.value as any) });
    setProducts((p.data as any) || []);
    setBranches(br.data || []);
  };
  useEffect(() => { load(); }, []);

  const withBucket = useMemo(() => batches.map((b) => ({ ...b, bucket: ageBucket(b.expiry_date, th) })), [batches, th]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    withBucket.forEach((b) => (c[b.bucket] = (c[b.bucket] || 0) + Number(b.quantity)));
    return c;
  }, [withBucket]);
  const filtered = filter === 'all' ? withBucket : withBucket.filter((b) => b.bucket === filter);
  const pg = usePagination(filtered);

  const saveThresholds = async () => {
    if (!(th.t1 < th.t2 && th.t2 < th.t3)) return toast.error('Thresholds must increase (e.g. 3 < 4 < 6)');
    const { error } = await supabase.from('system_settings').upsert({ key: 'expiry_ageing', value: th as any, updated_by: user?.id }, { onConflict: 'key' });
    error ? toast.error(error.message) : toast.success('Ageing thresholds saved');
  };

  const onMfg = (mfg: string) => {
    const p = products.find((x) => x.id === form.product_id);
    let expiry = form.expiry_date;
    if (mfg && p?.shelf_life_days) {
      const d = new Date(mfg + 'T00:00:00');
      d.setDate(d.getDate() + p.shelf_life_days);
      expiry = d.toISOString().slice(0, 10);
    }
    setForm({ ...form, mfg_date: mfg, expiry_date: expiry });
  };

  const addBatch = async () => {
    const qty = Number(form.quantity);
    if (!form.product_id || !form.branch_id || !qty || qty <= 0) return toast.error('Product, location and quantity are required');
    if (form.mfg_date && form.expiry_date && form.expiry_date < form.mfg_date) return toast.error('Expiry must be after manufacturing date');
    const { error } = await supabase.from('product_batches').insert({
      product_id: form.product_id, branch_id: form.branch_id, batch_number: form.batch_number || null,
      mfg_date: form.mfg_date || null, expiry_date: form.expiry_date || null, quantity: qty, created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    const { data: inv } = await supabase.from('branch_inventory').select('id, quantity').eq('branch_id', form.branch_id).eq('product_id', form.product_id).maybeSingle();
    if (inv) await supabase.from('branch_inventory').update({ quantity: Number(inv.quantity) + qty, last_restocked_at: new Date().toISOString() }).eq('id', inv.id);
    else await supabase.from('branch_inventory').insert({ branch_id: form.branch_id, product_id: form.product_id, quantity: qty });
    await supabase.from('stock_movements').insert({ branch_id: form.branch_id, product_id: form.product_id, operation_type: 'receive', quantity: qty, reason: `Batch ${form.batch_number || ''} received`, performed_by: user?.id });
    toast.success('Batch received');
    setOpen(false);
    setForm({ product_id: '', branch_id: '', batch_number: '', mfg_date: '', expiry_date: '', quantity: '' });
    load();
  };

  const buckets: AgeBucket[] = ['expired', 'b1', 'b2', 'b3', 'safe', 'none'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Shelf Life & Expiry Ageing</h1>
          <p className="text-muted-foreground">Track manufacturing and expiry dates by batch against today's date.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Receive Batch</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {buckets.map((b) => (
          <button key={b} onClick={() => setFilter(filter === b ? 'all' : b)} className={`rounded-xl border p-4 text-left transition ${filter === b ? 'ring-2 ring-primary' : ''}`}>
            <Badge className={bucketClass[b]}>{bucketLabel(b, th)}</Badge>
            <p className="text-2xl font-bold mt-2">{counts[b] || 0}</p>
            <p className="text-xs text-muted-foreground">units</p>
          </button>
        ))}
      </div>

      {hasRole('admin') && (
        <Card>
          <CardHeader><CardTitle className="text-base">Ageing Thresholds (months)</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            {(['t1', 't2', 't3'] as const).map((k, i) => (
              <div key={k} className="space-y-1">
                <Label>Bucket {i + 1}</Label>
                <Input type="number" className="w-24" value={th[k]} onChange={(e) => setTh({ ...th, [k]: Number(e.target.value) })} />
              </div>
            ))}
            <Button onClick={saveThresholds}><Save className="h-4 w-4 mr-2" />Save</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead><TableHead>Location</TableHead><TableHead>Batch</TableHead>
                <TableHead>Mfg Date</TableHead><TableHead>Expiry Date</TableHead><TableHead>Days Left</TableHead>
                <TableHead>Qty</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.pageItems.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No batches</TableCell></TableRow>
              ) : pg.pageItems.map((b) => {
                const d = daysUntil(b.expiry_date);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.product?.name}<div className="text-xs text-muted-foreground">{b.product?.sku}</div></TableCell>
                    <TableCell>{b.branch?.name}</TableCell>
                    <TableCell>{b.batch_number || '—'}</TableCell>
                    <TableCell>{b.mfg_date || '—'}</TableCell>
                    <TableCell>{b.expiry_date || '—'}</TableCell>
                    <TableCell>{d === null ? '—' : d}</TableCell>
                    <TableCell>{b.quantity}</TableCell>
                    <TableCell><Badge className={bucketClass[b.bucket]}>{bucketLabel(b.bucket, th)}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <PaginationBar {...pg} />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Receive Stock Batch</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Product</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Location</Label>
              <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Batch No.</Label><Input value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} /></div>
              <div className="space-y-1"><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
              <div className="space-y-1"><Label>Mfg Date</Label><Input type="date" value={form.mfg_date} onChange={(e) => onMfg(e.target.value)} /></div>
              <div className="space-y-1"><Label>Expiry Date</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Expiry is auto-filled from the product's shelf life when you pick a manufacturing date.</p>
          </div>
          <DialogFooter><Button onClick={addBatch}>Receive</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
