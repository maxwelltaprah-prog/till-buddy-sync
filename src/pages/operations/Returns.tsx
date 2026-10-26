import { useCurrency } from '@/hooks/useCurrency';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Search,
  RotateCcw,
  Loader2,
  Receipt,
  Package,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Sale = Tables<'sales'> & {
  sale_items: Tables<'sale_items'>[];
};

type Return = Tables<'returns'> & {
  return_items: Tables<'return_items'>[];
};

interface ReturnItem {
  saleItemId: string;
  productId: string;
  productName: string;
  originalQty: number;
  returnQty: number;
  unitPrice: number;
  refundAmount: number;
  restock: boolean;
}

export default function Returns() {
  const { formatPrice } = useCurrency();
  const { user, branch, roles } = useAuth();
  
  const [receiptNumber, setReceiptNumber] = useState('');
  const [foundSale, setFoundSale] = useState<Sale | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [returns, setReturns] = useState<Return[]>([]);
  const [isLoadingReturns, setIsLoadingReturns] = useState(true);

  // Load recent returns
  useEffect(() => {
    if (branch) {
      fetchReturns();
    }
  }, [branch]);

  const fetchReturns = async () => {
    try {
      setIsLoadingReturns(true);
      const { data, error } = await supabase
        .from('returns')
        .select(`*, return_items(*)`)
        .eq('branch_id', branch!.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setReturns(data as Return[] || []);
    } catch (error) {
      console.error('Error fetching returns:', error);
    } finally {
      setIsLoadingReturns(false);
    }
  };

  // Search for sale by receipt number
  const searchSale = async () => {
    if (!receiptNumber.trim()) {
      toast.error('Please enter a receipt number');
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select(`*, sale_items(*)`)
        .eq('receipt_number', receiptNumber.trim())
        .eq('status', 'completed')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          toast.error('Sale not found or already voided/refunded');
        } else {
          throw error;
        }
        setFoundSale(null);
        return;
      }

      setFoundSale(data as Sale);
      // Initialize return items
      setReturnItems(
        data.sale_items.map((item: Tables<'sale_items'>) => ({
          saleItemId: item.id,
          productId: item.product_id,
          productName: item.product_name,
          originalQty: item.quantity,
          returnQty: 0,
          unitPrice: item.unit_price,
          refundAmount: 0,
          restock: true,
        }))
      );
    } catch (error) {
      console.error('Error searching sale:', error);
      toast.error('Failed to search for sale');
    } finally {
      setIsSearching(false);
    }
  };

  // Update return quantity for an item
  const updateReturnQty = (index: number, qty: number) => {
    const item = returnItems[index];
    const validQty = Math.min(Math.max(0, qty), item.originalQty);
    const refund = validQty * item.unitPrice;
    
    const updated = [...returnItems];
    updated[index] = {
      ...item,
      returnQty: validQty,
      refundAmount: refund,
    };
    setReturnItems(updated);
  };

  // Toggle restock for an item
  const toggleRestock = (index: number) => {
    const updated = [...returnItems];
    updated[index] = {
      ...updated[index],
      restock: !updated[index].restock,
    };
    setReturnItems(updated);
  };

  // Calculate total refund
  const totalRefund = returnItems.reduce((sum, item) => sum + item.refundAmount, 0);
  const hasItemsToReturn = returnItems.some(item => item.returnQty > 0);

  // Process return
  const processReturn = async () => {
    if (!foundSale || !branch || !user) return;
    if (!returnReason.trim()) {
      toast.error('Please provide a reason for the return');
      return;
    }

    setIsProcessing(true);
    try {
      // Generate return number
      const { data: returnNumber, error: returnNumError } = await supabase.rpc(
        'generate_return_number',
        { branch_code: branch.code }
      );

      if (returnNumError) throw returnNumError;

      // Create return record
      const { data: returnRecord, error: returnError } = await supabase
        .from('returns')
        .insert({
          return_number: returnNumber,
          original_sale_id: foundSale.id,
          branch_id: branch.id,
          processed_by: user.id,
          total_refund: totalRefund,
          reason: returnReason,
          notes: returnNotes || null,
        })
        .select()
        .single();

      if (returnError) throw returnError;

      // Create return items
      const itemsToReturn = returnItems.filter(item => item.returnQty > 0);
      const returnItemRecords = itemsToReturn.map(item => ({
        return_id: returnRecord.id,
        sale_item_id: item.saleItemId,
        product_id: item.productId,
        quantity: item.returnQty,
        refund_amount: item.refundAmount,
        restock: item.restock,
      }));

      const { error: itemsError } = await supabase
        .from('return_items')
        .insert(returnItemRecords);

      if (itemsError) throw itemsError;

      // Update inventory for restocked items
      for (const item of itemsToReturn) {
        if (item.restock) {
          // Get current inventory
          const { data: currentInventory } = await supabase
            .from('branch_inventory')
            .select('quantity')
            .eq('branch_id', branch.id)
            .eq('product_id', item.productId)
            .single();

          if (currentInventory) {
            await supabase
              .from('branch_inventory')
              .update({ quantity: currentInventory.quantity + item.returnQty })
              .eq('branch_id', branch.id)
              .eq('product_id', item.productId);
          }

          // Record stock movement
          await supabase.from('stock_movements').insert({
            branch_id: branch.id,
            product_id: item.productId,
            operation_type: 'return',
            quantity: item.returnQty,
            reference_id: returnRecord.id,
            reference_type: 'return',
            performed_by: user.id,
            reason: `Return: ${returnReason}`,
          });
        }
      }

      // Update original sale status
      await supabase
        .from('sales')
        .update({ status: 'refunded' })
        .eq('id', foundSale.id);

      toast.success(`Return processed! Return #: ${returnNumber}`);
      setShowConfirmDialog(false);
      resetForm();
      fetchReturns();
    } catch (error) {
      console.error('Error processing return:', error);
      toast.error('Failed to process return');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setReceiptNumber('');
    setFoundSale(null);
    setReturnItems([]);
    setReturnReason('');
    setReturnNotes('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Returns</h1>
        <p className="text-muted-foreground">
          Process customer returns and refunds
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Search and process return */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Process Return
            </CardTitle>
            <CardDescription>
              Search for a sale by receipt number to process a return
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter receipt number..."
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchSale()}
                  className="pl-10"
                />
              </div>
              <Button onClick={searchSale} disabled={isSearching}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Search'
                )}
              </Button>
            </div>

            {/* Found sale details */}
            {foundSale && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{foundSale.receipt_number}</span>
                    <Badge variant="outline">
                      {format(new Date(foundSale.created_at!), 'MMM d, yyyy HH:mm')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Original Total: {formatPrice(foundSale.total)}
                  </p>
                </div>

                {/* Items selection */}
                <div className="space-y-2">
                  <Label>Select items to return:</Label>
                  <ScrollArea className="h-[200px] border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="w-[80px]">Orig</TableHead>
                          <TableHead className="w-[100px]">Return</TableHead>
                          <TableHead className="w-[80px]">Restock</TableHead>
                          <TableHead className="w-[80px] text-right">Refund</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {returnItems.map((item, index) => (
                          <TableRow key={item.saleItemId}>
                            <TableCell className="font-medium text-sm">
                              {item.productName}
                            </TableCell>
                            <TableCell>{item.originalQty}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max={item.originalQty}
                                value={item.returnQty}
                                onChange={(e) => updateReturnQty(index, parseInt(e.target.value) || 0)}
                                className="w-16 h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Checkbox
                                checked={item.restock}
                                onCheckedChange={() => toggleRestock(index)}
                                disabled={item.returnQty === 0}
                              />
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatPrice(item.refundAmount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>

                {/* Reason */}
                <div>
                  <Label>Reason for return *</Label>
                  <Textarea
                    placeholder="Enter reason for return..."
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="mt-1"
                  />
                </div>

                {/* Notes */}
                <div>
                  <Label>Additional notes (optional)</Label>
                  <Textarea
                    placeholder="Any additional notes..."
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    className="mt-1"
                  />
                </div>

                {/* Total and submit */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Refund</p>
                    <p className="text-2xl font-bold">{formatPrice(totalRefund)}</p>
                  </div>
                  <Button
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={!hasItemsToReturn || !returnReason.trim()}
                  >
                    Process Return
                  </Button>
                </div>
              </div>
            )}

            {!foundSale && !isSearching && receiptNumber && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No sale found</p>
                <p className="text-sm text-muted-foreground/70">
                  Enter a valid receipt number to search
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent returns */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Returns</CardTitle>
            <CardDescription>
              View recently processed returns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {isLoadingReturns ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : returns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No returns yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {returns.map((ret) => (
                    <div
                      key={ret.id}
                      className="p-4 rounded-lg border bg-background"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium font-mono text-sm">
                          {ret.return_number}
                        </span>
                        <Badge variant="secondary">
                          {ret.return_items.length} items
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mb-1">
                        {ret.reason}
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {format(new Date(ret.created_at!), 'MMM d, HH:mm')}
                        </span>
                        <span className="font-bold text-destructive">
                          -{formatPrice(ret.total_refund)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Return</DialogTitle>
            <DialogDescription>
              Are you sure you want to process this return?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground mb-2">Items to return:</p>
              {returnItems
                .filter(item => item.returnQty > 0)
                .map(item => (
                  <div key={item.saleItemId} className="flex justify-between text-sm">
                    <span>{item.productName} × {item.returnQty}</span>
                    <span className="font-mono">{formatPrice(item.refundAmount)}</span>
                  </div>
                ))}
              <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                <span>Total Refund:</span>
                <span className="text-destructive">{formatPrice(totalRefund)}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 mt-0.5 text-success" />
              <span>
                Items marked for restock will be added back to inventory
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={processReturn}
              disabled={isProcessing}
              variant="destructive"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm Return'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
