import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/hooks/useCurrency';
import { useReportBranch } from '@/hooks/useReportBranch';
import { ReportBranchSelector } from '@/components/ReportBranchSelector';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaginationBar, usePagination } from '@/components/PaginationBar';
import { format } from 'date-fns';

export default function ProfitReport() {
  const scope = useReportBranch();
  const { formatPrice, code } = useCurrency();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!scope.canView) { setItems([]); setIsLoading(false); return; }
    if (!from || !to || from > to) { setItems([]); setIsLoading(false); return; }
    let active = true;
    setItems([]);
    setIsLoading(true);
    const start = new Date(from + 'T00:00:00').toISOString();
    const end = new Date(to + 'T23:59:59.999').toISOString();
    let query = supabase.from('sale_items')
      .select('product_id, product_name, quantity, total, cost_price, product:products(cost_price), sale:sales!inner(created_at, status, branch_id)')
      .gte('sale.created_at', start).lte('sale.created_at', end).eq('sale.status', 'completed');
    if (scope.branchId) query = query.eq('sale.branch_id', scope.branchId);
    query.then(({ data, error }) => {
      if (!active) return;
      if (error) toast.error('Failed to load profit report');
      else setItems(data || []);
      setIsLoading(false);
    });
    return () => { active = false; };
  }, [from, to, scope.branchId, scope.canView]);

  const rows = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; revenue: number; cost: number }>();
    items.forEach((i) => {
      const unitCost = Number(i.cost_price) || Number(i.product?.cost_price) || 0;
      const r = m.get(i.product_id) || { name: i.product_name, qty: 0, revenue: 0, cost: 0 };
      r.qty += Number(i.quantity); r.revenue += Number(i.total); r.cost += unitCost * Number(i.quantity);
      m.set(i.product_id, r);
    });
    return [...m.values()].map((r) => ({ ...r, profit: r.revenue - r.cost })).sort((a, b) => b.profit - a.profit);
  }, [items]);

  const tot = rows.reduce((s, r) => ({ revenue: s.revenue + r.revenue, cost: s.cost + r.cost }), { revenue: 0, cost: 0 });
  const profit = tot.revenue - tot.cost;
  const margin = tot.revenue ? (profit / tot.revenue) * 100 : 0;
  const pg = usePagination(rows);

  if (!scope.canView) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">No branch selected</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Profit Report</h1>
          <p className="text-muted-foreground">{scope.branchName} · All amounts in {code}.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <ReportBranchSelector scope={scope} />
          <div className="space-y-1"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[['Revenue', formatPrice(tot.revenue)], ['Cost of Goods', formatPrice(tot.cost)], ['Gross Profit', formatPrice(profit)], ['Margin', `${margin.toFixed(1)}%`]].map(([l, v]) => (
          <Card key={l}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{l}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{isLoading ? '—' : v}</p></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty Sold</TableHead><TableHead>Revenue</TableHead><TableHead>Cost</TableHead><TableHead>Profit</TableHead><TableHead>Margin</TableHead></TableRow></TableHeader>
            <TableBody>
              {pg.pageItems.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{isLoading ? 'Loading profit report…' : from > to ? 'Select a valid date range' : 'No sales in this period'}</TableCell></TableRow>
              ) : pg.pageItems.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell><TableCell>{r.qty}</TableCell>
                  <TableCell>{formatPrice(r.revenue)}</TableCell><TableCell>{formatPrice(r.cost)}</TableCell>
                  <TableCell className={r.profit < 0 ? 'text-destructive' : 'text-success'}>{formatPrice(r.profit)}</TableCell>
                  <TableCell>{r.revenue ? ((r.profit / r.revenue) * 100).toFixed(1) : '0.0'}%</TableCell>
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
