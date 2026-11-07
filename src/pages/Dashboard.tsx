import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from 'react-router-dom';
import { startOfDay, endOfDay, format, subDays } from 'date-fns';
import {
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  Banknote,
  Boxes,
  ArrowRight,
  Loader2,
  AlertTriangle,
  ReceiptText,
  CheckCircle2,
} from 'lucide-react';
import { ROLE_LABELS } from '@/types/database';
import { TransactionDetailsDialog } from '@/components/TransactionDetailsDialog';
import { dashboardStock, salesGrowth, consolidateBranches, totalUnits, type StockEntry } from '@/lib/dashboardMetrics';
import { ErrorState } from '@/components/states';
import { toast } from 'sonner';
import { useBranchScope } from '@/hooks/useBranchScope';
import { Copy, RefreshCw } from 'lucide-react';

interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  totalProducts: number;
  lowStockItems: number;
  dayGrowth: number | null;
}

export default function Dashboard() {
  const { profile, roles, branch, store, user, canAccessScreen } = useAuth();
  const { formatPrice } = useCurrency();
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayTransactions: 0,
    totalProducts: 0,
    lowStockItems: 0,
    dayGrowth: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lowStock, setLowStock] = useState<StockEntry[]>([]);
  const [recentSales, setRecentSales] = useState<{ id: string; receipt: string; total: number; time: string }[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const isAdmin = roles.includes('admin');
  const isCashier = roles.includes('cashier');
  const isStockManager = roles.includes('stock_manager');
  const [refresh, setRefresh] = useState(0);
  const { allBranches } = useBranchScope();
  const [units, setUnits] = useState(0);
  const [branchCount, setBranchCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setRecentSales([]); setLowStock([]); setSelectedSaleId(null);
      setStats({ todaySales: 0, todayTransactions: 0, totalProducts: 0, lowStockItems: 0, dayGrowth: null });
      if (!branch?.id || !store?.id || !user?.id) { setIsLoading(false); return; }
      setIsLoading(true); setLoadError(false);
      try {
        const today = new Date();
        let salesQuery = supabase.from('sales')
          .select('id, total, receipt_number, created_at')
          .eq('store_id', store.id).eq('status', 'completed')
          .gte('created_at', startOfDay(subDays(today, 1)).toISOString())
          .lte('created_at', endOfDay(today).toISOString()).order('created_at', { ascending: false });
        // Cashiers see their own sales only; branch stock is shared for restocking.
        if (!allBranches) salesQuery = salesQuery.eq('branch_id', branch.id);
        if (!isAdmin && isCashier) salesQuery = salesQuery.eq('cashier_id', user.id);
        const [salesResult, inventoryResult] = await Promise.all([
          salesQuery,
          supabase.from('branch_inventory')
            .select('product_id, branch_id, quantity, is_available, product:products(name, sku, min_stock_level, is_active, removed_at)')
            .eq('store_id', store.id).eq(allBranches ? 'store_id' : 'branch_id', allBranches ? store.id : branch.id),
        ]);
        if (salesResult.error) throw salesResult.error;
        if (inventoryResult.error) throw inventoryResult.error;
        const todayStart = startOfDay(today).toISOString();
        const sales = (salesResult.data ?? []).filter(sale => sale.created_at && sale.created_at >= todayStart);
        const yesterday = (salesResult.data ?? []).filter(sale => sale.created_at && sale.created_at < todayStart);
        const todayTotal = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
        const yesterdayTotal = yesterday.reduce((sum, sale) => sum + Number(sale.total), 0);
        const invRows = ((inventoryResult.data ?? []) as (StockEntry & { branch_id: string; product: (StockEntry['product'] & { removed_at?: string | null }) | null })[])
          .filter(row => !row.product?.removed_at);
        const scoped = allBranches ? consolidateBranches(invRows) : invRows;
        const stock = dashboardStock(scoped);
        setUnits(totalUnits(scoped.filter(e => e.is_available && e.product?.is_active && Number(e.quantity ?? 0) > 0)));
        setBranchCount(new Set(invRows.filter(row => Number(row.quantity ?? 0) > 0).map(row => row.branch_id)).size);
        if (!active) return;
        setLowStock(stock.low);
        setRecentSales(sales.slice(0,5).map(sale => ({ id:sale.id, receipt:sale.receipt_number, total:sale.total, time:sale.created_at ? format(new Date(sale.created_at),'HH:mm') : '—' })));
        setStats({ todaySales:todayTotal, todayTransactions:sales.length, totalProducts:stock.totalProducts, lowStockItems:stock.low.length, dayGrowth:salesGrowth(todayTotal,yesterdayTotal) });
      } catch (error) {
        if (active) setLoadError(true);
        console.error('Error fetching dashboard data:',error);
      } finally { if (active) setIsLoading(false); }
    };
    void load();
    const interval = window.setInterval(() => void load(), 60000);
    return () => { active = false; window.clearInterval(interval); };
  }, [branch?.id, store?.id, user?.id, isAdmin, isCashier, refresh, allBranches]);

  const copyRestockList = async () => {
    try {
      const text = `Restock request — ${allBranches ? 'All branches' : branch?.name || 'Branch'}\n${format(new Date(), 'dd MMM yyyy')}\n\n` + lowStock.map(item => `${item.product?.name} (${item.product?.sku}) — stock: ${item.quantity ?? 0}, minimum: ${item.product?.min_stock_level ?? 0}`).join('\n');
      await navigator.clipboard.writeText(text);
      toast.success('Restock list copied for your administrator or warehouse team');
    } catch { toast.error('Could not copy the restock list. Please try again.'); }
  };

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary via-primary/90 to-accent p-6 text-primary-foreground shadow-lg shadow-primary/20 md:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary-foreground/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 right-1/3 h-48 w-48 rounded-full bg-primary-foreground/10 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary-foreground/80">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {roles.length > 0 && <span className="rounded-full bg-primary-foreground/15 px-3 py-1 font-medium backdrop-blur">{ROLE_LABELS[roles[0] as keyof typeof ROLE_LABELS]}</span>}
              {branch && !isAdmin && <span className="rounded-full bg-primary-foreground/15 px-3 py-1 font-medium backdrop-blur">{branch.name}</span>}
              {branch && isAdmin && <span className="rounded-full bg-primary-foreground/15 px-3 py-1 font-medium backdrop-blur">{allBranches ? 'All branches' : branch.name}</span>}
            </div>
          </div>
          <Button variant="secondary" size="sm" disabled={isLoading} onClick={() => setRefresh(n => n + 1)} className="shadow-md">
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </section>

      {/* Stats overview */}
      {loadError ? <ErrorState title="Could not load dashboard" onRetry={() => setRefresh(n => n + 1)} /> : !branch ? <p className="text-sm text-muted-foreground">No branch assigned. Contact your administrator.</p> : (isAdmin || isCashier) && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { title: isCashier && !isAdmin ? 'My Sales Today' : "Today's Sales", icon: Banknote, tone: 'success', value: formatPrice(stats.todaySales), note: `${stats.todayTransactions} transaction${stats.todayTransactions === 1 ? '' : 's'}` },
            { title: 'Products', icon: Package, tone: 'primary', value: String(stats.totalProducts), note: allBranches ? `${units.toLocaleString('en-US')} units across ${branchCount} branch${branchCount === 1 ? '' : 'es'}` : `${units.toLocaleString('en-US')} units at this branch` },
            { title: 'Low Stock', icon: AlertTriangle, tone: stats.lowStockItems > 0 ? 'destructive' : 'accent', value: String(stats.lowStockItems), note: stats.lowStockItems > 0 ? 'Items need restocking' : 'All items well stocked' },
            { title: 'Growth', icon: TrendingUp, tone: stats.dayGrowth !== null && stats.dayGrowth < 0 ? 'destructive' : 'warning', value: stats.dayGrowth === null ? '—' : `${stats.dayGrowth > 0 ? '+' : ''}${stats.dayGrowth.toFixed(1)}%`, note: stats.dayGrowth === null ? 'No sales yesterday to compare' : 'Sales vs. yesterday' },
          ].map(({ title, icon: Icon, tone, value, note }) => {
            const tones: Record<string, { bar: string; chip: string; text: string }> = {
              success: { bar: 'bg-success', chip: 'bg-success/15 text-success', text: 'text-success' },
              primary: { bar: 'bg-primary', chip: 'bg-primary/15 text-primary', text: 'text-primary' },
              accent: { bar: 'bg-accent', chip: 'bg-accent/15 text-accent', text: 'text-accent' },
              warning: { bar: 'bg-warning', chip: 'bg-warning/15 text-warning', text: 'text-foreground' },
              destructive: { bar: 'bg-destructive', chip: 'bg-destructive/15 text-destructive', text: 'text-destructive' },
            };
            const t = tones[tone];
            return (
              <Card key={title} className="relative overflow-hidden border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${t.bar}`} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${t.chip}`}><Icon className="h-5 w-5" /></div>
                  </div>
                  <div className={`mt-3 text-3xl font-bold tracking-tight tabular-nums ${t.text}`}>
                    {isLoading ? <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /> : value}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{note}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { show: isAdmin || isCashier, to: '/pos', title: 'POS Terminal', desc: 'Start processing sales', icon: ShoppingCart, chip: 'bg-primary text-primary-foreground', ring: 'hover:border-primary/40' },
            { show: isAdmin || isStockManager, to: '/products', title: 'Products', desc: 'Manage product catalog', icon: Package, chip: 'bg-accent text-accent-foreground', ring: 'hover:border-accent/40' },
            { show: isAdmin || isStockManager, to: '/inventory', title: 'Inventory', desc: 'Check stock levels', icon: Boxes, chip: 'bg-success text-success-foreground', ring: 'hover:border-success/40' },
            { show: isAdmin, to: '/users', title: 'Users', desc: 'Manage staff accounts', icon: Users, chip: 'bg-warning text-warning-foreground', ring: 'hover:border-warning/40' },
          ].filter(a => a.show).map(({ to, title, desc, icon: Icon, chip, ring }) => (
            <Link key={to} to={to} className={`group flex items-center gap-4 rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${ring}`}>
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-md ${chip}`}><Icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{title}</p>
                <p className="truncate text-xs text-muted-foreground">{desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
            </Link>
          ))}
        </div>
      </section>

      {/* Branch restock list */}
      {(isAdmin || isCashier) && !loadError && !isLoading && branch && (
        <section aria-labelledby="restock-heading" className="border-y bg-card">
          <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
            <div><h2 id="restock-heading" className="flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="h-5 w-5 text-warning" />Restock watchlist <span className="text-sm font-normal text-muted-foreground">({lowStock.length})</span></h2><p className="mt-1 text-sm text-muted-foreground">{allBranches ? 'All branches (combined stock)' : branch.name} · At or below minimum stock</p></div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={!lowStock.length} onClick={() => void copyRestockList()}><Copy className="mr-2 h-4 w-4" />Copy restock list</Button>
              {canAccessScreen('/inventory') && <Button asChild variant="ghost" size="sm"><Link to="/inventory">Inventory<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}
            </div>
          </header>
          {lowStock.length ? <Table><TableHeader><TableRow><TableHead className="pl-4 sm:pl-6">Product</TableHead><TableHead className="text-right">On hand</TableHead><TableHead className="text-right">Minimum</TableHead><TableHead className="pr-4 text-right sm:pr-6">Status</TableHead></TableRow></TableHeader><TableBody>{lowStock.slice(0,10).map(item => <TableRow key={item.product_id}><TableCell className="pl-4 sm:pl-6"><p className="font-medium">{item.product?.name}</p><p className="text-xs text-muted-foreground">{item.product?.sku}</p></TableCell><TableCell className="text-right tabular-nums">{item.quantity ?? 0}</TableCell><TableCell className="text-right tabular-nums">{item.product?.min_stock_level ?? 0}</TableCell><TableCell className="pr-4 text-right text-xs sm:pr-6"><span className={Number(item.quantity ?? 0) <= 0 ? 'text-destructive' : 'text-warning'}>{Number(item.quantity ?? 0) <= 0 ? 'Out of stock' : 'Low stock'}</span></TableCell></TableRow>)}</TableBody></Table> : <p className="border-t px-6 py-8 text-sm text-muted-foreground">All available products are above their minimum stock levels.</p>}
          {lowStock.length > 10 && <p className="px-6 py-3 text-xs text-muted-foreground">Showing 10 of {lowStock.length} · Copied list includes all products</p>}
        </section>
      )}

      {/* Recent activity */}
      <section aria-labelledby="recent-activity-heading" className="border-y border-border bg-card text-card-foreground">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <div className="space-y-1">
            <h2 id="recent-activity-heading" className="text-lg font-semibold text-foreground">Recent Activity</h2>
            <p className="text-sm text-muted-foreground">{isCashier && !isAdmin ? "My completed sales today" : "Today's completed sales"}</p>
          </div>
          {isAdmin && (
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link to="/reports">Sales report <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          )}
        </header>
        <div>
          {isLoading ? (
            <div role="status" className="flex items-center justify-center gap-2 border-t py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading transactions…
            </div>
          ) : recentSales.length > 0 ? (
            <Table className="border-t">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 pl-4 text-xs sm:pl-6">Receipt</TableHead>
                  <TableHead className="hidden h-10 text-xs sm:table-cell">Time</TableHead>
                  <TableHead className="hidden h-10 text-xs md:table-cell">Status</TableHead>
                  <TableHead className="h-10 pr-4 text-right text-xs sm:pr-6">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSales.map((sale) => (
                  <TableRow key={sale.receipt}>
                    <TableCell className="py-4 pl-4 sm:pl-6">
                      <div className="flex items-center gap-3">
                        <ReceiptText aria-hidden="true" className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
                        <div>
                          <Button variant="link" className="h-auto whitespace-normal break-all p-0 text-left text-sm font-medium text-foreground" aria-label={`View transaction ${sale.receipt}`} onClick={() => setSelectedSaleId(sale.id)}>{sale.receipt}</Button>
                          <span className="mt-1 block text-xs text-muted-foreground sm:hidden">{sale.time}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">{sale.time}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-success" /> Completed
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap pr-4 text-right font-semibold tabular-nums sm:pr-6">{formatPrice(sale.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 border-t px-4 py-12 text-center">
              <ReceiptText className="mb-1 h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">No sales today</p>
              <p className="text-xs text-muted-foreground">{branch?.name || 'This branch'} · {format(new Date(), 'dd MMM yyyy')}</p>
            </div>
          )}
        </div>
      </section>
      <TransactionDetailsDialog saleId={selectedSaleId} onClose={() => setSelectedSaleId(null)} />
    </div>
  );
}
