import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PaginationBar, usePagination } from '@/components/PaginationBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Search,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Loader2,
  Package,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  ArrowRightLeft,
} from 'lucide-react';
import type { Tables, Enums } from '@/integrations/supabase/types';

type StockMovement = Tables<'stock_movements'> & {
  product: Tables<'products'>;
};

const OPERATION_LABELS: Record<Enums<'stock_operation_type'>, string> = {
  receive: 'Stock Received',
  sale: 'Sale',
  return: 'Return',
  adjustment: 'Adjustment',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
};

const OPERATION_ICONS: Record<Enums<'stock_operation_type'>, React.ElementType> = {
  receive: ArrowDownCircle,
  sale: TrendingDown,
  return: RotateCcw,
  adjustment: RefreshCw,
  transfer_in: ArrowDownCircle,
  transfer_out: ArrowUpCircle,
};

export default function StockMovements() {
  const { branch } = useAuth();
  
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [operationFilter, setOperationFilter] = useState<string>('all');

  useEffect(() => {
    if (branch) {
      fetchMovements();
    }
  }, [branch]);

  const fetchMovements = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          product:products(*)
        `)
        .eq('branch_id', branch!.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setMovements(data as StockMovement[]);
    } catch (error) {
      console.error('Error fetching movements:', error);
      toast.error('Failed to load stock movements');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMovements = movements.filter((movement) => {
    const matchesSearch = 
      movement.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movement.product.sku.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (operationFilter !== 'all' && movement.operation_type !== operationFilter) {
      return false;
    }

    return true;
  });
  const pg = usePagination(filteredMovements);

  // Calculate summary stats
  const stats = {
    received: movements
      .filter(m => m.operation_type === 'receive')
      .reduce((sum, m) => sum + m.quantity, 0),
    sold: Math.abs(movements
      .filter(m => m.operation_type === 'sale')
      .reduce((sum, m) => sum + m.quantity, 0)),
    returned: movements
      .filter(m => m.operation_type === 'return')
      .reduce((sum, m) => sum + m.quantity, 0),
    adjusted: movements
      .filter(m => m.operation_type === 'adjustment')
      .reduce((sum, m) => sum + Math.abs(m.quantity), 0),
  };

  if (!branch) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No branch selected</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Movements</h1>
          <p className="text-muted-foreground">
            Track all inventory changes for {branch.name}
          </p>
        </div>
        <Button onClick={fetchMovements} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stock Received</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">+{stats.received}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Items Sold</CardTitle>
            <TrendingDown className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-{stats.sold}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Returns</CardTitle>
            <RotateCcw className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">+{stats.returned}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Adjustments</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.adjusted}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={operationFilter} onValueChange={setOperationFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="receive">Stock Received</SelectItem>
            <SelectItem value="sale">Sales</SelectItem>
            <SelectItem value="return">Returns</SelectItem>
            <SelectItem value="adjustment">Adjustments</SelectItem>
            <SelectItem value="transfer_in">Transfer In</SelectItem>
            <SelectItem value="transfer_out">Transfer Out</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Movements table */}
      <Card>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Reference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No movements found
                  </TableCell>
                </TableRow>
              ) : (
                pg.pageItems.map((movement) => {
                  const Icon = OPERATION_ICONS[movement.operation_type];
                  const isPositive = movement.quantity > 0;
                  
                  return (
                    <TableRow key={movement.id}>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(movement.created_at!), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{movement.product.name}</p>
                            <p className="text-xs text-muted-foreground">{movement.product.sku}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Icon className="h-3 w-3" />
                          {OPERATION_LABELS[movement.operation_type]}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${
                        isPositive ? 'text-success' : 'text-destructive'
                      }`}>
                        {isPositive ? '+' : ''}{movement.quantity}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {movement.reason || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono">
                        {movement.reference_type ? `${movement.reference_type}` : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <PaginationBar {...pg} />
        </ScrollArea>
      </Card>
    </div>
  );
}
