import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaginationBar, usePagination } from '@/components/PaginationBar';
import { toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Loc { id: string; name: string; location_type: string; }

export default function StockTransfers() {
  const [locs, setLocs] = useState<Loc[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [available, setAvailable] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [l, p, h] = await Promise.all([
      supabase.from('branches').select('id, name, location_type').eq('is_active', true).order('name'),
      supabase.from('products').select('id, name, sku').eq('is_active', true).order('name'),
      supabase.from('stock_transfers').select('*, product:products(name), from:branches!stock_transfers_from_branch_id_fkey(name), to:branches!stock_transfers_to_branch_id_fkey(name)').order('created_at', { ascending: false }).limit(500),
    ]);
    setLocs((l.data as Loc[]) || []);
    setProducts(p.data || []);
    setHistory(h.data || []);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!from || !productId) return setAvailable(null);
    supabase.from('branch_inventory').select('quantity').eq('branch_id', from).eq('product_id', productId).maybeSingle()
      .then(({ data }) => setAvailable(Number(data?.quantity || 0)));
  }, [from, productId]);

  const submit = async () => {
    const q = Number(qty);
    if (!from || !to || !productId || !q) return toast.error('Fill in all fields');
    if (from === to) return toast.error('Choose two different locations');
    setBusy(true);
    const { error } = await supabase.rpc('transfer_stock', { p_from: from, p_to: to, p_product: productId, p_qty: q, p_notes: notes || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Stock transferred');
    setQty(''); setNotes('');
    setAvailable((a) => (a ?? 0) - q);
    load();
  };

  const pg = usePagination(history);
  const typeLabel = (t: string) => (t === 'warehouse' ? 'Warehouse' : 'Sales Point');

  const LocSelect = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <div className="space-y-1 flex-1 min-w-[180px]">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
        <SelectContent>{locs.map((l) => <SelectItem key={l.id} value={l.id}>{l.name} · {typeLabel(l.location_type)}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stock Transfers</h1>
        <p className="text-muted-foreground">Move stock between warehouses and sales points.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>New Transfer</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <LocSelect value={from} onChange={setFrom} label="From" />
            <ArrowRight className="h-5 w-5 mb-2 text-muted-foreground" />
            <LocSelect value={to} onChange={setTo} label="To" />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 min-w-[220px]">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quantity {available !== null && <span className="text-muted-foreground">(available {available})</span>}</Label>
              <Input type="number" className="w-36" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Transfer</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Transfer History</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Qty</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
            <TableBody>
              {pg.pageItems.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No transfers yet</TableCell></TableRow>
              ) : pg.pageItems.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{format(new Date(t.created_at), 'PP p')}</TableCell>
                  <TableCell>{t.product?.name}</TableCell>
                  <TableCell>{t.from?.name}</TableCell>
                  <TableCell>{t.to?.name}</TableCell>
                  <TableCell><Badge variant="secondary">{t.quantity}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{t.notes || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar {...pg} />
        </CardContent>
      </Card>
    </div>
  );
}
