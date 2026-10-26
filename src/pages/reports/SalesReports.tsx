import { useState, useEffect, useRef } from 'react';
import { Package } from 'lucide-react';
import { ReportBranchSelector } from '@/components/ReportBranchSelector';
import { useCurrency } from '@/hooks/useCurrency';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Loader2,
  Download,
  RefreshCw,
  Calendar as CalendarIcon,
  Receipt,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Sale = Tables<'sales'> & {
  sale_items: Tables<'sale_items'>[];
};

type DateRange = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export default function SalesReports() {
  const scope = useReportBranch();
  const requestId = useRef(0);
  const { formatPrice, code } = useCurrency();
  
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));
  const [customStartOpen, setCustomStartOpen] = useState(false);
  const [customEndOpen, setCustomEndOpen] = useState(false);

  useEffect(() => {
    if (dateRange !== 'custom') {
      updateDateRange(dateRange);
    }
  }, [dateRange]);

  useEffect(() => {
    if (scope.canView) {
      fetchSales();
    }
    return () => { requestId.current += 1; };
  }, [scope.branchId, scope.canView, startDate, endDate]);

  const updateDateRange = (range: DateRange) => {
    const now = new Date();
    switch (range) {
      case 'today':
        setStartDate(startOfDay(now));
        setEndDate(endOfDay(now));
        break;
      case 'yesterday':
        const yesterday = subDays(now, 1);
        setStartDate(startOfDay(yesterday));
        setEndDate(endOfDay(yesterday));
        break;
      case 'week':
        setStartDate(startOfWeek(now));
        setEndDate(endOfWeek(now));
        break;
      case 'month':
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
    }
  };

  const handleCustomStartDate = (date: Date | undefined) => {
    if (date) {
      const newStart = startOfDay(date);
      setStartDate(newStart);
      setDateRange('custom');
      setCustomStartOpen(false);
    }
  };

  const handleCustomEndDate = (date: Date | undefined) => {
    if (date) {
      const newEnd = endOfDay(date);
      setEndDate(newEnd);
      setDateRange('custom');
      setCustomEndOpen(false);
    }
  };

  const fetchSales = async () => {
    if (!scope.canView) return;
    const currentRequest = ++requestId.current;
    try {
      setIsLoading(true);
      setLoadError(false);
      setSales([]);
      let query = supabase
        .from('sales')
        .select(`
          *,
          sale_items(*)
        `)
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });
      if (scope.branchId) query = query.eq('branch_id', scope.branchId);
      const { data, error } = await query;
      if (currentRequest !== requestId.current) return;
      if (error) throw error;
      setSales(data as Sale[] || []);
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      console.error('Error fetching sales:', error);
      setLoadError(true);
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  };

  // Calculate stats
  const stats = {
    totalSales: sales.length,
    totalRevenue: sales.reduce((sum, s) => sum + s.total, 0),
    totalTax: sales.reduce((sum, s) => sum + (s.tax_amount || 0), 0),
    totalDiscount: sales.reduce((sum, s) => sum + (s.discount_amount || 0), 0),
    averageOrderValue: sales.length > 0 
      ? sales.reduce((sum, s) => sum + s.total, 0) / sales.length 
      : 0,
    itemsSold: sales.reduce((sum, s) => 
      sum + s.sale_items.reduce((iSum, item) => iSum + item.quantity, 0), 0
    ),
  };

  // Prepare hourly chart data
  const hourlyData = Array.from({ length: 24 }, (_, hour) => {
    const hourSales = sales.filter(s => {
      const saleHour = s.created_at ? new Date(s.created_at).getHours() : -1;
      return saleHour === hour;
    });
    return {
      hour: `${hour.toString().padStart(2, '0')}:00`,
      sales: hourSales.length,
      revenue: hourSales.reduce((sum, s) => sum + s.total, 0),
    };
  });

  // Top selling products
  const productSales = sales.reduce((acc, sale) => {
    sale.sale_items.forEach(item => {
      if (!acc[item.product_id]) {
        acc[item.product_id] = {
          name: item.product_name,
          quantity: 0,
          revenue: 0,
        };
      }
      acc[item.product_id].quantity += item.quantity;
      acc[item.product_id].revenue += item.total;
    });
    return acc;
  }, {} as Record<string, { name: string; quantity: number; revenue: number }>);

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const exportToCSV = () => {
    const headers = ['Receipt #', 'Date', 'Items', 'Subtotal', 'Tax', 'Total'];
    const rows = sales.map(s => [
      s.receipt_number,
      s.created_at ? format(new Date(s.created_at), 'yyyy-MM-dd HH:mm') : '',
      s.sale_items.length,
      s.subtotal.toFixed(2),
      (s.tax_amount || 0).toFixed(2),
      s.total.toFixed(2),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${scope.branchId ?? 'all-branches'}-${format(startDate, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  };

  if (!scope.canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No branch selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sales Reports</h1>
          <p className="text-muted-foreground">
            {scope.branchName} · All amounts in {code}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchSales} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={exportToCSV} variant="outline" disabled={isLoading}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Date range selector */}
      <div className="flex flex-wrap items-center gap-4">
        <ReportBranchSelector scope={scope} />
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={(v: DateRange) => setDateRange(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {dateRange === 'custom' && (
          <div className="flex items-center gap-2">
            <Popover open={customStartOpen} onOpenChange={setCustomStartOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  {format(startDate, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={handleCustomStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">to</span>
            <Popover open={customEndOpen} onOpenChange={setCustomEndOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  {format(endDate, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={handleCustomEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
        
        <Badge variant="outline">
          {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <CardsLoading />
          <div className="rounded-lg border bg-card"><Table><TableBody><TableLoadingRows cols={6} /></TableBody></Table></div>
        </div>
      ) : loadError ? (
        <Card><ErrorState title="Couldn't load sales" onRetry={fetchSales} /></Card>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPrice(stats.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.totalSales} transactions
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Average Order</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPrice(stats.averageOrderValue)}</div>
                <p className="text-xs text-muted-foreground">Per transaction</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Items Sold</CardTitle>
                <ShoppingCart className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.itemsSold}</div>
                <p className="text-xs text-muted-foreground">Total quantity</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Tax Collected</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatPrice(stats.totalTax)}</div>
                <p className="text-xs text-muted-foreground">
                  Discounts: {formatPrice(stats.totalDiscount)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="products">Top Products</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sales by Hour</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="hour" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="products" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Top Selling Products</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Quantity Sold</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.length === 0 ? (
                        <TableStateRow cols={3}>
                          <EmptyState icon={Package} title="No products sold yet" description="Best sellers appear here once sales are made in this period." />
                        </TableStateRow>
                      ) : (
                        topProducts.map((product, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell className="text-right">{product.quantity}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatPrice(product.revenue)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions" className="space-y-4">
              <Card>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt #</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.length === 0 ? (
                        <TableStateRow cols={6}>
                          <EmptyState icon={Receipt} title="No transactions in this period" description="Pick a wider date range or another branch to see sales." />
                        </TableStateRow>
                      ) : (
                        sales.map((sale) => (
                          <TableRow key={sale.id}>
                            <TableCell className="font-mono text-sm">
                              {sale.receipt_number}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {sale.created_at ? format(new Date(sale.created_at), 'MMM d, HH:mm') : '—'}
                            </TableCell>
                            <TableCell className="text-right">{sale.sale_items.length}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatPrice(sale.subtotal)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {formatPrice(sale.tax_amount || 0)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {formatPrice(sale.total)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
