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
import { dashboardStock, salesGrowth, type StockEntry } from '@/lib/dashboardMetrics';
import { ErrorState } from '@/components/states';
import { toast } from 'sonner';
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
          .eq('store_id', store.id).eq('branch_id', branch.id).eq('status', 'completed')
          .gte('created_at', startOfDay(subDays(today, 1)).toISOString())
          .lte('created_at', endOfDay(today).toISOString()).order('created_at', { ascending: false });
        // Cashiers see their own sales only; branch stock is shared for restocking.
        if (!isAdmin && isCashier) salesQuery = salesQuery.eq('cashier_id', user.id);
        const [salesResult, inventoryResult] = await Promise.all([
          salesQuery,
          supabase.from('branch_inventory')
            .select('product_id, quantity, is_available, product:products(name, sku, min_stock_level, is_active)')
            .eq('store_id', store.id).eq('branch_id', branch.id),
        ]);
        if (salesResult.error) throw salesResult.error;
        if (inventoryResult.error) throw inventoryResult.error;
        const todayStart = startOfDay(today).toISOString();
        const sales = (salesResult.data ?? []).filter(sale => sale.created_at && sale.created_at >= todayStart);
        const yesterday = (salesResult.data ?? []).filter(sale => sale.created_at && sale.created_at < todayStart);
        const todayTotal = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
        const yesterdayTotal = yesterday.reduce((sum, sale) => sum + Number(sale.total), 0);
        const stock = dashboardStock(inventoryResult.data ?? []);
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
  }, [branch?.id, store?.id, user?.id, isAdmin, isCashier, refresh]);

  const copyRestockList = async () => {
    try {
      const text = `Restock request — ${branch?.name || 'Branch'}\n${format(new Date(), 'dd MMM yyyy')}\n\n` + lowStock.map(item => `${item.product?.name} (${item.product?.sku}) — stock: ${item.quantity ?? 0}, minimum: ${item.product?.min_stock_level ?? 0}`).join('\n');
      await navigator.clipboard.writeText(text);
      toast.success('Restock list copied for your administrator or warehouse team');
    } catch { toast.error('Could not copy the restock list. Please try again.'); }
  };

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}
        </h1>
        <p className="text-muted-foreground">
          {roles.length > 0 && ROLE_LABELS[roles[0] as keyof typeof ROLE_LABELS]}
          {branch && ` • ${branch.name}`}
        </p>
      </div>

      <div className="flex justify-end"><Button variant="ghost" size="sm" disabled={isLoading} onClick={() => setRefresh(n => n + 1)}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
      {/* Quick actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {(isAdmin || isCashier) && (
          <Card className="hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 group border-2 border-transparent hover:border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">POS Terminal</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <ShoppingCart className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Start processing sales
              </p>
              <Button asChild size="sm" className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/20">
                <Link to="/pos">
                  Open POS
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {(isAdmin || isStockManager) && (
          <Card className="hover:shadow-xl hover:shadow-accent/10 transition-all duration-300 group border-2 border-transparent hover:border-accent/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Products</CardTitle>
              <div className="p-2 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
                <Package className="h-4 w-4 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Manage product catalog
              </p>
              <Button asChild size="sm" variant="outline" className="w-full border-accent/30 hover:bg-accent/10 hover:text-accent hover:border-accent">
                <Link to="/products">
                  View Products
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {(isAdmin || isStockManager) && (
          <Card className="hover:shadow-xl hover:shadow-success/10 transition-all duration-300 group border-2 border-transparent hover:border-success/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Inventory</CardTitle>
              <div className="p-2 rounded-lg bg-success/10 group-hover:bg-success/20 transition-colors">
                <Boxes className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Check stock levels
              </p>
              <Button asChild size="sm" variant="outline" className="w-full border-success/30 hover:bg-success/10 hover:text-success hover:border-success">
                <Link to="/inventory">
                  View Inventory
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card className="hover:shadow-xl hover:shadow-warning/10 transition-all duration-300 group border-2 border-transparent hover:border-warning/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Users</CardTitle>
              <div className="p-2 rounded-lg bg-warning/10 group-hover:bg-warning/20 transition-colors">
                <Users className="h-4 w-4 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Manage staff accounts
              </p>
              <Button asChild size="sm" variant="outline" className="w-full border-warning/30 hover:bg-warning/10 hover:text-warning hover:border-warning">
                <Link to="/users">
                  Manage Users
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stats overview */}
      {loadError ? <ErrorState title="Could not load dashboard" onRetry={() => setRefresh(n => n + 1)} /> : !branch ? <p className="text-sm text-muted-foreground">No branch assigned. Contact your administrator.</p> : (isAdmin || isCashier) && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-success/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{isCashier && !isAdmin ? "My Sales Today" : "Today's Sales"}</CardTitle>
              <div className="p-2 rounded-full bg-success/20">
                <Banknote className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-success" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-success">{formatPrice(stats.todaySales)}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.todayTransactions} transactions
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Products</CardTitle>
              <div className="p-2 rounded-full bg-primary/20">
                <Package className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-primary">{stats.totalProducts}</div>
                  <p className="text-xs text-muted-foreground">
                    Available at this branch
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={`${stats.lowStockItems > 0 ? 'border-warning/30' : 'border-border'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <div className={`p-2 rounded-full ${stats.lowStockItems > 0 ? 'bg-destructive/20' : 'bg-accent/20'}`}>
                <Boxes className={`h-4 w-4 ${stats.lowStockItems > 0 ? 'text-destructive' : 'text-accent'}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className={`text-3xl font-bold ${stats.lowStockItems > 0 ? 'text-destructive' : 'text-accent'}`}>
                    {stats.lowStockItems}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Items need restocking
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Growth</CardTitle>
              <div className="p-2 rounded-full bg-warning/20">
                <TrendingUp className="h-4 w-4 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold tabular-nums ${stats.dayGrowth !== null && stats.dayGrowth < 0 ? 'text-destructive' : 'text-success'}`}>{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.dayGrowth === null ? '—' : `${stats.dayGrowth > 0 ? '+' : ''}${stats.dayGrowth.toFixed(1)}%`}</div>
              <p className="text-xs text-muted-foreground">
                {stats.dayGrowth === null ? "No sales yesterday to compare" : "Sales vs. yesterday"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Branch restock list */}
      {(isAdmin || isCashier) && !loadError && !isLoading && branch && (
        <section aria-labelledby="restock-heading" className="border-y bg-card">
          <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
            <div><h2 id="restock-heading" className="flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="h-5 w-5 text-warning" />Restock watchlist <span className="text-sm font-normal text-muted-foreground">({lowStock.length})</span></h2><p className="mt-1 text-sm text-muted-foreground">{branch.name} · At or below minimum stock</p></div>
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
