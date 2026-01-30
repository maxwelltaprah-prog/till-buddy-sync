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
    <div className="p-6 space-y-6">
      {/* Welcome section */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">
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
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">POS Terminal</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Start processing sales
              </p>
              <Button asChild size="sm" className="w-full">
                <Link to="/pos">
                  Open POS
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {(isAdmin || isStockManager) && (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Manage product catalog
              </p>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link to="/products">
                  View Products
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {(isAdmin || isStockManager) && (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Inventory</CardTitle>
              <Boxes className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Check stock levels
              </p>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link to="/inventory">
                  View Inventory
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Manage staff accounts
              </p>
              <Button asChild size="sm" variant="outline" className="w-full">
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">${stats.todaySales.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.todayTransactions} transactions
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats.totalProducts}</div>
                  <p className="text-xs text-muted-foreground">
                    Active products
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <Boxes className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className={`text-2xl font-bold ${stats.lowStockItems > 0 ? 'text-destructive' : ''}`}>
                    {stats.lowStockItems}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Items need restocking
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Growth</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">—</div>
              <p className="text-xs text-muted-foreground">
                vs. last week
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Low stock alert */}
      {isAdmin && !isLoading && stats.lowStockItems > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="h-8 w-8 text-warning" />
            <div className="flex-1">
              <p className="font-medium">Low Stock Alert</p>
              <p className="text-sm text-muted-foreground">
                {stats.lowStockItems} products are below minimum stock level
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/inventory">View Inventory</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Your recent transactions and actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : recentSales.length > 0 ? (
            <div className="space-y-3">
              {recentSales.map((sale, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <ShoppingCart className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{sale.receipt}</p>
                      <p className="text-xs text-muted-foreground">{sale.time}</p>
                    </div>
                  </div>
                  <span className="font-mono font-medium">${sale.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No recent activity</p>
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
