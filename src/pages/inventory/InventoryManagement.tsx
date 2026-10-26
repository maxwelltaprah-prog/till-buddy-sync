import { useCurrency } from '@/hooks/useCurrency';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Search,
  Package,
  Plus,
  Minus,
  ArrowUpDown,
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Product = Tables<'products'>;
type BranchInventory = Tables<'branch_inventory'> & {
  product: Product;
};

type OperationType = 'receive' | 'adjustment' | 'transfer_out';

export default function InventoryManagement() {
  const { formatPrice } = useCurrency();
  const { branch, hasPermission } = useAuth();
  
  const [inventory, setInventory] = useState<BranchInventory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BranchInventory | null>(null);
  const [operationType, setOperationType] = useState<OperationType>('receive');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');

  useEffect(() => {
    if (branch) {
      fetchInventory();
    }
  }, [branch]);

  const fetchInventory = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('branch_inventory')
        .select(`
          *,
          product:products(*)
        `)
        .eq('branch_id', branch!.id)
        .order('quantity', { ascending: true });

      if (error) throw error;
      setInventory(data as BranchInventory[]);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = 
      item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product.sku.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'low') {
      return item.quantity <= (item.product.min_stock_level || 10) && item.quantity > 0;
    }
    if (filter === 'out') {
      return item.quantity <= 0;
    }
    return true;
  });
  const pg = usePagination(filteredInventory);

  const handleStockOperation = async () => {
    if (!selectedItem || !quantity || parseInt(quantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    setIsSubmitting(true);
    try {
      const qty = parseInt(quantity);
      let newQuantity: number;
      let movementQuantity: number;

      switch (operationType) {
        case 'receive':
          newQuantity = (selectedItem.quantity || 0) + qty;
          movementQuantity = qty;
          break;
        case 'transfer_out':
          if (qty > (selectedItem.quantity || 0)) {
            toast.error('Insufficient stock for transfer');
            return;
          }
          newQuantity = (selectedItem.quantity || 0) - qty;
          movementQuantity = -qty;
          break;
        case 'adjustment':
          // For adjustment, quantity is the new total
          newQuantity = qty;
          movementQuantity = qty - (selectedItem.quantity || 0);
          break;
        default:
          throw new Error('Invalid operation type');
      }

      // Update inventory
      const { error: updateError } = await supabase
        .from('branch_inventory')
        .update({
          quantity: newQuantity,
          last_restocked_at: operationType === 'receive' ? new Date().toISOString() : undefined,
        })
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      // Record stock movement
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          branch_id: branch!.id,
          product_id: selectedItem.product.id,
          operation_type: operationType,
          quantity: movementQuantity,
          reason: reason || null,
          performed_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (movementError) throw movementError;

      toast.success('Stock updated successfully');
      setShowStockDialog(false);
      resetForm();
      fetchInventory();
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Failed to update stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedItem(null);
    setQuantity('');
    setReason('');
    setOperationType('receive');
  };

  const openStockDialog = (item: BranchInventory, type: OperationType) => {
    setSelectedItem(item);
    setOperationType(type);
    setShowStockDialog(true);
  };

  const getStockStatus = (item: BranchInventory) => {
    const qty = item.quantity || 0;
    const minStock = item.product.min_stock_level || 10;
    
    if (qty <= 0) {
      return { label: 'Out of Stock', variant: 'destructive' as const, icon: AlertTriangle };
    }
    if (qty <= minStock) {
      return { label: 'Low Stock', variant: 'warning' as const, icon: TrendingDown };
    }
    return { label: 'In Stock', variant: 'success' as const, icon: TrendingUp };
  };

  const stats = {
    total: inventory.length,
    lowStock: inventory.filter(i => i.quantity <= (i.product.min_stock_level || 10) && i.quantity > 0).length,
    outOfStock: inventory.filter(i => i.quantity <= 0).length,
    totalValue: inventory.reduce((sum, i) => sum + (i.quantity || 0) * (i.product.retail_price || 0), 0),
  };

  if (!branch) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No branch selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">
            Manage stock levels for {branch.name}
          </p>
        </div>
        <Button onClick={fetchInventory} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <TrendingDown className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.lowStock}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.outOfStock}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(stats.totalValue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filter} onValueChange={(value: 'all' | 'low' | 'out') => setFilter(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inventory table */}
      <Card>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Min Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredInventory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                pg.pageItems.map((item) => {
                  const status = getStockStatus(item);
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.product.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.product.sku}</TableCell>
                      <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {item.product.min_stock_level}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant as any} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPrice(((item.quantity || 0) * item.product.retail_price))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 items-center">
                          <Button
                            size="sm"
                            variant={(item as any).is_available === false ? 'secondary' : 'ghost'}
                            title="Enable or disable selling this product at this sales point"
                            onClick={async () => {
                              const next = (item as any).is_available === false;
                              const { error } = await supabase.from('branch_inventory').update({ is_available: next }).eq('id', item.id);
                              if (error) return toast.error(error.message);
                              toast.success(next ? 'Product enabled at this location' : 'Product hidden from POS at this location');
                              fetchInventory();
                            }}
                          >
                            {(item as any).is_available === false ? 'Disabled' : 'On sale'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openStockDialog(item, 'receive')}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Receive
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openStockDialog(item, 'adjustment')}
                          >
                            <ArrowUpDown className="h-3 w-3 mr-1" />
                            Adjust
                          </Button>
                        </div>
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

      {/* Stock operation dialog */}
      <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {operationType === 'receive' && 'Receive Stock'}
              {operationType === 'adjustment' && 'Adjust Stock'}
              {operationType === 'transfer_out' && 'Transfer Out'}
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.product.name} - Current Stock: {selectedItem?.quantity}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Operation Type</Label>
              <Select 
                value={operationType} 
                onValueChange={(value: OperationType) => setOperationType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receive">Receive Stock</SelectItem>
                  <SelectItem value="adjustment">Stock Adjustment</SelectItem>
                  <SelectItem value="transfer_out">Transfer Out</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {operationType === 'adjustment' ? 'New Quantity' : 'Quantity'}
              </Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                placeholder={operationType === 'adjustment' ? 'Enter new total' : 'Enter quantity'}
              />
            </div>

            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for this operation..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStockDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleStockOperation} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
