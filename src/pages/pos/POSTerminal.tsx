import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  ShoppingCart,
  Package,
  Loader2,
  X,
  Calculator,
} from 'lucide-react';
import type { Product, CartItem, BulkPricingTier } from '@/types/database';

interface ProductWithInventory extends Product {
  branch_inventory: { quantity: number }[];
}

export default function POSTerminal() {
  const { user, branch } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State
  const [products, setProducts] = useState<ProductWithInventory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculated values
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = cart.reduce(
    (sum, item) => sum + (item.total * (item.product.tax_rate / 100)),
    0
  );
  const total = subtotal + taxAmount;
  const changeAmount = Math.max(0, parseFloat(cashReceived || '0') - total);

  // Fetch products
  useEffect(() => {
    fetchProducts();
  }, [branch]);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          bulk_pricing_tiers(*),
          branch_inventory!inner(quantity)
        `)
        .eq('is_active', true);

      if (branch) {
        query = query.eq('branch_inventory.branch_id', branch.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProducts((data as ProductWithInventory[]) || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  // Search products
  const filteredProducts = products.filter((product) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query) ||
      product.barcode?.toLowerCase().includes(query)
    );
  });

  // Get effective price based on quantity
  const getEffectivePrice = (product: Product, quantity: number): { price: number; isBulk: boolean } => {
    if (!product.bulk_pricing_tiers || product.bulk_pricing_tiers.length === 0) {
      return { price: product.retail_price, isBulk: false };
    }

    const activeTiers = product.bulk_pricing_tiers
      .filter((tier) => tier.is_active)
      .sort((a, b) => b.min_quantity - a.min_quantity);

    for (const tier of activeTiers) {
      if (quantity >= tier.min_quantity) {
        if (!tier.max_quantity || quantity <= tier.max_quantity) {
          return { price: tier.price, isBulk: true };
        }
      }
    }

    return { price: product.retail_price, isBulk: false };
  };

  // Add product to cart
  const addToCart = (product: ProductWithInventory) => {
    const existingIndex = cart.findIndex((item) => item.product.id === product.id);
    const availableStock = product.branch_inventory?.[0]?.quantity || 0;

    if (existingIndex >= 0) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty >= availableStock) {
        toast.error('Not enough stock available');
        return;
      }
      updateQuantity(existingIndex, currentQty + 1);
    } else {
      if (availableStock <= 0) {
        toast.error('Product out of stock');
        return;
      }
      const { price, isBulk } = getEffectivePrice(product, 1);
      const newItem: CartItem = {
        product,
        quantity: 1,
        unit_price: price,
        is_bulk_price: isBulk,
        discount_amount: 0,
        total: price,
      };
      setCart([...cart, newItem]);
    }
  };

  // Update quantity
  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(index);
      return;
    }

    const item = cart[index];
    const availableStock = (item.product as ProductWithInventory).branch_inventory?.[0]?.quantity || 0;

    if (newQuantity > availableStock) {
      toast.error('Not enough stock available');
      return;
    }

    const { price, isBulk } = getEffectivePrice(item.product, newQuantity);
    const updatedCart = [...cart];
    updatedCart[index] = {
      ...item,
      quantity: newQuantity,
      unit_price: price,
      is_bulk_price: isBulk,
      total: price * newQuantity - item.discount_amount,
    };
    setCart(updatedCart);
  };

  // Remove from cart
  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
  };

  // Process payment
  const processPayment = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const received = parseFloat(cashReceived || '0');
    if (received < total) {
      toast.error('Insufficient payment amount');
      return;
    }

    if (!branch) {
      toast.error('No branch selected');
      return;
    }

    setIsProcessing(true);
    try {
      // Generate receipt number
      const { data: receiptData, error: receiptError } = await supabase.rpc(
        'generate_receipt_number',
        { branch_code: branch.code }
      );

      if (receiptError) throw receiptError;

      // Create sale record
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          receipt_number: receiptData,
          branch_id: branch.id,
          cashier_id: user!.id,
          subtotal,
          discount_amount: 0,
          tax_amount: taxAmount,
          total,
          cash_received: received,
          change_given: changeAmount,
          status: 'completed',
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        is_bulk_price: item.is_bulk_price,
        discount_amount: item.discount_amount,
        tax_amount: item.total * (item.product.tax_rate / 100),
        total: item.total,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Update inventory and record stock movements
      for (const item of cart) {
        // First get current quantity
        const { data: currentInventory } = await supabase
          .from('branch_inventory')
          .select('quantity')
          .eq('branch_id', branch.id)
          .eq('product_id', item.product.id)
          .single();

        if (currentInventory) {
          const newQuantity = currentInventory.quantity - item.quantity;
          const { error: inventoryError } = await supabase
            .from('branch_inventory')
            .update({ quantity: newQuantity })
            .eq('branch_id', branch.id)
            .eq('product_id', item.product.id);

          if (inventoryError) {
            console.error('Inventory update error:', inventoryError);
          }
        }

        // Record stock movement
        await supabase.from('stock_movements').insert({
          branch_id: branch.id,
          product_id: item.product.id,
          operation_type: 'sale',
          quantity: -item.quantity,
          reference_id: sale.id,
          reference_type: 'sale',
          performed_by: user!.id,
        });
      }

      toast.success(`Sale completed! Receipt: ${receiptData}`);
      setShowPaymentDialog(false);
      setCashReceived('');
      clearCart();
      fetchProducts(); // Refresh stock
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick cash buttons
  const quickCashAmounts = [10, 20, 50, 100, 200, 500];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Products panel */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Search bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search by name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-lg"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Products grid */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No products found' : 'No products available'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((product) => {
                const stock = product.branch_inventory?.[0]?.quantity || 0;
                const inCart = cart.find((item) => item.product.id === product.id);
                
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={stock <= 0}
                    className="p-4 rounded-lg border bg-card text-left hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed relative group"
                  >
                    {inCart && (
                      <Badge className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 rounded-full">
                        {inCart.quantity}
                      </Badge>
                    )}
                    <div className="aspect-square bg-muted rounded-md mb-2 flex items-center justify-center">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover rounded-md"
                        />
                      ) : (
                        <Package className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{product.sku}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold">${product.retail_price.toFixed(2)}</span>
                      <span className={`text-xs ${stock <= product.min_stock_level ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {stock} in stock
                      </span>
                    </div>
                    {product.is_bulk_item && product.bulk_pricing_tiers?.length > 0 && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        Bulk pricing available
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Cart panel */}
      <div className="w-96 border-l bg-card flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Cart
              {cart.length > 0 && (
                <Badge variant="secondary">{cart.length}</Badge>
              )}
            </h2>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart}>
                Clear
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-4">
              <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Cart is empty</p>
              <p className="text-sm text-muted-foreground/70">
                Click on products to add them
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {cart.map((item, index) => (
                <div
                  key={item.product.id}
                  className="flex gap-3 p-3 rounded-lg border bg-background"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.product.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground">
                        ${item.unit_price.toFixed(2)}
                      </span>
                      {item.is_bulk_price && (
                        <Badge variant="outline" className="text-xs price-bulk">
                          Bulk
                        </Badge>
                      )}
                    </div>
                    <p className="font-semibold mt-1">${item.total.toFixed(2)}</p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFromCart(index)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(index, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(index, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Cart totals and payment */}
        <div className="border-t p-4 space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>${taxAmount.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <Button
            className="w-full h-14 text-lg"
            size="lg"
            disabled={cart.length === 0}
            onClick={() => setShowPaymentDialog(true)}
          >
            <DollarSign className="mr-2 h-5 w-5" />
            Pay ${total.toFixed(2)}
          </Button>
        </div>
      </div>

      {/* Payment dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Cash Payment
            </DialogTitle>
            <DialogDescription>
              Total amount: <span className="font-bold text-foreground">${total.toFixed(2)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Cash Received</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="0.00"
                className="h-14 text-2xl text-center font-bold"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {quickCashAmounts.map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  onClick={() => setCashReceived(amount.toString())}
                >
                  ${amount}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setCashReceived(total.toFixed(2))}
            >
              Exact Amount (${total.toFixed(2)})
            </Button>

            {parseFloat(cashReceived || '0') >= total && (
              <div className="p-4 rounded-lg bg-success/10 text-center">
                <p className="text-sm text-muted-foreground">Change to give</p>
                <p className="text-3xl font-bold text-success">${changeAmount.toFixed(2)}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={processPayment}
              disabled={parseFloat(cashReceived || '0') < total || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Complete Sale'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
