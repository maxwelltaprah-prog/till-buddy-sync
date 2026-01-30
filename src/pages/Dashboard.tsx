import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { startOfDay, endOfDay, format } from 'date-fns';
import {
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  DollarSign,
  Boxes,
  ArrowRight,
  BarChart3,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { ROLE_LABELS } from '@/types/database';

interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  totalProducts: number;
  lowStockItems: number;
  weekGrowth: number | null;
}

export default function Dashboard() {
  const { profile, roles, branch } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayTransactions: 0,
    totalProducts: 0,
    lowStockItems: 0,
    weekGrowth: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [recentSales, setRecentSales] = useState<{ receipt: string; total: number; time: string }[]>([]);

  const isAdmin = roles.includes('admin');
  const isCashier = roles.includes('cashier');
  const isStockManager = roles.includes('stock_manager');

  useEffect(() => {
    if (branch) {
      fetchDashboardData();
    }
  }, [branch]);

  const fetchDashboardData = async () => {
    if (!branch) return;
    
    setIsLoading(true);
    try {
      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);

      // Fetch today's sales
      const { data: todaySalesData, error: salesError } = await supabase
        .from('sales')
        .select('total, receipt_number, created_at')
        .eq('branch_id', branch.id)
        .eq('status', 'completed')
        .gte('created_at', startOfToday.toISOString())
        .lte('created_at', endOfToday.toISOString());

      if (salesError) throw salesError;

      const todaySales = todaySalesData?.reduce((sum, sale) => sum + sale.total, 0) || 0;
      const todayTransactions = todaySalesData?.length || 0;

      // Set recent sales
      const recent = (todaySalesData || [])
        .slice(0, 5)
        .map(sale => ({
          receipt: sale.receipt_number,
          total: sale.total,
          time: format(new Date(sale.created_at!), 'HH:mm'),
        }));
      setRecentSales(recent);

      // Fetch total products
      const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Fetch low stock items
      const { data: inventoryData } = await supabase
        .from('branch_inventory')
        .select(`
          quantity,
          product:products(min_stock_level, is_active)
        `)
        .eq('branch_id', branch.id);

      const lowStockItems = inventoryData?.filter(item => {
        const product = item.product as { min_stock_level: number; is_active: boolean } | null;
        return product?.is_active && item.quantity <= (product?.min_stock_level || 0);
      }).length || 0;

      setStats({
        todaySales,
        todayTransactions,
        totalProducts: productCount || 0,
        lowStockItems,
        weekGrowth: null, // Could calculate from historical data
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-background via-background to-muted/30 min-h-full">
      {/* Welcome section */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}
        </h1>
        <p className="text-muted-foreground">
          {roles.length > 0 && ROLE_LABELS[roles[0] as keyof typeof ROLE_LABELS]}
          {branch && ` • ${branch.name}`}
        </p>
      </div>

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
      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
              <div className="p-2 rounded-full bg-success/20">
                <DollarSign className="h-4 w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-success" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-success">${stats.todaySales.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.todayTransactions} transactions
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
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
                    Active products
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br ${stats.lowStockItems > 0 ? 'from-destructive/10 to-destructive/5 border-destructive/20' : 'from-accent/10 to-accent/5 border-accent/20'}`}>
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

          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Growth</CardTitle>
              <div className="p-2 rounded-full bg-warning/20">
                <TrendingUp className="h-4 w-4 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">—</div>
              <p className="text-xs text-muted-foreground">
                vs. last week
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Low stock alert */}
      {isAdmin && !isLoading && stats.lowStockItems > 0 && (
        <Card className="border-2 border-warning/30 bg-gradient-to-r from-warning/10 via-warning/5 to-transparent animate-pulse-soft">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="p-3 rounded-full bg-warning/20">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-warning">Low Stock Alert</p>
              <p className="text-sm text-muted-foreground">
                {stats.lowStockItems} products are below minimum stock level
              </p>
            </div>
            <Button asChild className="bg-warning text-warning-foreground hover:bg-warning/90">
              <Link to="/inventory">View Inventory</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent activity */}
      <Card className="border-2 border-transparent hover:border-primary/10 transition-all duration-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            Recent Activity
          </CardTitle>
          <CardDescription>
            Your recent transactions and actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : recentSales.length > 0 ? (
            <div className="space-y-3">
              {recentSales.map((sale, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 hover:from-primary/10 hover:to-accent/5 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                      <ShoppingCart className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{sale.receipt}</p>
                      <p className="text-xs text-muted-foreground">{sale.time}</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-lg text-success">${sale.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <BarChart3 className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground font-medium">No recent activity</p>
              <p className="text-sm text-muted-foreground/70">
                Start by adding products and making your first sale
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
