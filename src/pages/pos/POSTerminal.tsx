import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useShopSettings } from '@/contexts/ShopSettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  Printer,
  Receipt,
  Barcode,
  LayoutGrid,
  List,
  Grid3X3,
} from 'lucide-react';
import type { Product, CartItem, BulkPricingTier } from '@/types/database';
import { generateReceiptPDF, printThermalReceipt, type ReceiptData, type ShopBranding } from '@/lib/receiptGenerator';
import { BarcodeScanner, useBarcodeKeyboardScanner } from '@/components/pos/BarcodeScanner';
import { PaginationBar, usePagination } from '@/components/PaginationBar';
import { useTaxComponents } from '@/hooks/useTaxComponents';
import { calculateTaxes } from '@/lib/tax';

interface ProductWithInventory extends Product {
  branch_inventory: { quantity: number; is_available?: boolean }[];
  expired_qty?: number;
}

export default function POSTerminal() {
  const { user, branch } = useAuth();
  const { formatPrice, symbol } = useCurrency();
  const { settings: shopSettings } = useShopSettings();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State
  const [products, setProducts] = useState<ProductWithInventory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddToCartDialog, setShowAddToCartDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithInventory | null>(null);
  const [addQuantity, setAddQuantity] = useState(1);
  const [useBulkPricing, setUseBulkPricing] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<ReceiptData | null>(null);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>(
    () => (localStorage.getItem('pos_view_mode') as 'grid' | 'list' | 'compact') || 'grid'
  );
  const changeView = (m: 'grid' | 'list' | 'compact') => { setViewMode(m); localStorage.setItem('pos_view_mode', m); };
  const { components: taxComponents } = useTaxComponents();

  // Calculated values (Ghana decoupled tax on taxable subtotal)
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const taxResult = calculateTaxes(subtotal, taxComponents);
  const taxAmount = taxResult.total;
  const total = subtotal + taxAmount;
  const changeAmount = Math.max(0, parseFloat(cashReceived || '0') - total);

  // Handle barcode scan
  const handleBarcodeScanned = useCallback((barcode: string) => {
    const product = products.find(
      (p) => p.barcode?.toLowerCase() === barcode.toLowerCase() || p.sku.toLowerCase() === barcode.toLowerCase()
    );
    
    if (product) {
      quickAddToCart(product);
      toast.success(`Added ${product.name} to cart`);
    } else {
      toast.error(`Product not found: ${barcode}`);
    }
  }, [products]);

  // Use keyboard barcode scanner hook
  useBarcodeKeyboardScanner(handleBarcodeScanned);

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
          branch_inventory(quantity, is_available)
        `)
        .eq('is_active', true);

      if (branch) {
        query = query.eq('branch_inventory.branch_id', branch.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      // Expired batches at this branch cannot be sold: remove them from sellable stock
      const today = new Date().toISOString().slice(0, 10);
      const expiredMap = new Map<string, number>();
      if (branch) {
        const { data: expired } = await supabase
          .from('product_batches')
          .select('product_id, quantity')
          .eq('branch_id', branch.id)
          .gt('quantity', 0)
          .lt('expiry_date', today);
        expired?.forEach((b) => expiredMap.set(b.product_id, (expiredMap.get(b.product_id) || 0) + Number(b.quantity)));
      }
      const list = ((data as ProductWithInventory[]) || []).map((p) => {
        const expiredQty = expiredMap.get(p.id) || 0;
        if (!expiredQty) return p;
        const inv = p.branch_inventory?.[0];
        return {
          ...p,
          expired_qty: expiredQty,
          branch_inventory: [{ ...(inv || { quantity: 0 }), quantity: Math.max(0, Number(inv?.quantity || 0) - expiredQty) }],
        };
      });
      setProducts(list);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  // Search products
  const filteredProducts = products.filter((product) => {
    if (product.branch_inventory?.[0]?.is_available === false) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query) ||
      product.barcode?.toLowerCase().includes(query)
    );
  });
  const productPage = usePagination(filteredProducts, 30);

  // Get effective price based on quantity and pricing preference
  const getEffectivePrice = (product: Product, quantity: number, forceBulk: boolean = false): { price: number; isBulk: boolean } => {
    if (!product.bulk_pricing_tiers || product.bulk_pricing_tiers.length === 0 || !forceBulk) {
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

  // Get bulk price info for display
  const getBulkPriceInfo = (product: Product): { minQty: number; price: number } | null => {
    if (!product.bulk_pricing_tiers || product.bulk_pricing_tiers.length === 0) return null;
    const activeTiers = product.bulk_pricing_tiers
      .filter((tier) => tier.is_active)
      .sort((a, b) => a.min_quantity - b.min_quantity);
    if (activeTiers.length === 0) return null;
    return { minQty: activeTiers[0].min_quantity, price: activeTiers[0].price };
  };

  // Open add to cart dialog
  const openAddToCartDialog = (product: ProductWithInventory) => {
    if (product.expired_qty) {
      const sellable = product.branch_inventory?.[0]?.quantity || 0;
      if (sellable <= 0) {
        toast.error(`${product.name}: all stock is EXPIRED — sale blocked. Remove expired batch from shelf.`);
        return;
      }
      toast.warning(`${product.name}: ${product.expired_qty} expired unit(s) must not be sold. Only ${sellable} sellable.`);
    }
    setSelectedProduct(product);
    setAddQuantity(1);
    const hasBulkPricing = product.bulk_pricing_tiers && product.bulk_pricing_tiers.length > 0;
    setUseBulkPricing(hasBulkPricing && product.is_bulk_item);
    setShowAddToCartDialog(true);
  };

  // Confirm add to cart
  const confirmAddToCart = () => {
    if (!selectedProduct) return;
    
    const availableStock = selectedProduct.branch_inventory?.[0]?.quantity || 0;
    if (addQuantity > availableStock) {
      toast.error('Not enough stock available');
      return;
    }

    const existingIndex = cart.findIndex((item) => item.product.id === selectedProduct.id);
    
    if (existingIndex >= 0) {
      const newQty = cart[existingIndex].quantity + addQuantity;
      if (newQty > availableStock) {
        toast.error('Not enough stock available');
        return;
      }
      updateQuantityWithPricing(existingIndex, newQty, useBulkPricing);
    } else {
      const { price, isBulk } = getEffectivePrice(selectedProduct, addQuantity, useBulkPricing);
      const newItem: CartItem = {
        product: selectedProduct,
        quantity: addQuantity,
        unit_price: price,
        is_bulk_price: isBulk,
        discount_amount: 0,
        total: price * addQuantity,
      };
      setCart([...cart, newItem]);
    }
    
    setShowAddToCartDialog(false);
    setSelectedProduct(null);
  };

  // Quick add (single item retail price)
  const quickAddToCart = (product: ProductWithInventory) => {
    if (product.expired_qty) {
      const sellable = product.branch_inventory?.[0]?.quantity || 0;
      if (sellable <= 0) {
        toast.error(`${product.name}: all stock is EXPIRED — sale blocked. Remove expired batch from shelf.`);
        return;
      }
      toast.warning(`${product.name}: ${product.expired_qty} expired unit(s) must not be sold. Only ${sellable} sellable.`);
    }
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
      const newItem: CartItem = {
        product,
        quantity: 1,
        unit_price: product.retail_price,
        is_bulk_price: false,
        discount_amount: 0,
        total: product.retail_price,
      };
      setCart([...cart, newItem]);
    }
  };

  // Update quantity maintaining pricing type
  const updateQuantityWithPricing = (index: number, newQuantity: number, forceBulk: boolean) => {
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

    const { price, isBulk } = getEffectivePrice(item.product, newQuantity, forceBulk);
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

  // Update quantity
  const updateQuantity = (index: number, newQuantity: number) => {
    const item = cart[index];
    updateQuantityWithPricing(index, newQuantity, item.is_bulk_price);
  };

  // Remove from cart
  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
  };

  // Toggle pricing type for cart item
  const togglePricingType = (index: number) => {
    const item = cart[index];
    updateQuantityWithPricing(index, item.quantity, !item.is_bulk_price);
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

    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    setIsProcessing(true);
    try {
      // Create sale with atomic receipt number generation
      const { data: saleResult, error: saleError } = await supabase.rpc(
        'create_sale_with_receipt',
        {
          p_branch_id: branch.id,
          p_branch_code: branch.code,
          p_cashier_id: user.id,
          p_subtotal: subtotal,
          p_discount_amount: 0,
          p_tax_amount: taxAmount,
          p_total: total,
          p_cash_received: received,
          p_change_given: changeAmount,
        }
      );

      if (saleError) {
        console.error('Sale creation error:', saleError);
        throw new Error(saleError.message || 'Failed to create sale');
      }
      
      if (!saleResult || saleResult.length === 0) {
        throw new Error('No sale data returned from database');
      }

      const sale = { id: saleResult[0].sale_id };
      const receiptData = saleResult[0].receipt_number;

      // Create sale items
      const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        is_bulk_price: item.is_bulk_price,
        discount_amount: item.discount_amount,
        tax_amount: calculateTaxes(item.total, taxComponents).total,
        tax_breakdown: calculateTaxes(item.total, taxComponents).lines as any,
        cost_price: Number(item.product.cost_price) || 0,
        total: item.total,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) {
        console.error('Sale items error:', itemsError);
        throw new Error(itemsError.message || 'Failed to save sale items');
      }

      // Update inventory and record stock movements
      for (const item of cart) {
        const { data: currentInventory } = await supabase
          .from('branch_inventory')
          .select('quantity')
          .eq('branch_id', branch.id)
          .eq('product_id', item.product.id)
          .single();

        if (currentInventory) {
          const newQuantity = (currentInventory.quantity || 0) - item.quantity;
          await supabase
            .from('branch_inventory')
            .update({ quantity: newQuantity })
            .eq('branch_id', branch.id)
            .eq('product_id', item.product.id);
        }

        await supabase.from('stock_movements').insert({
          branch_id: branch.id,
          product_id: item.product.id,
          operation_type: 'sale',
          quantity: -item.quantity,
          reference_id: sale.id,
          reference_type: 'sale',
          performed_by: user.id,
        });
      }

      // Prepare receipt data with shop branding
      const branding: ShopBranding = {
        shopName: shopSettings.shop_name,
        tagline: shopSettings.tagline,
        logoUrl: shopSettings.logo_url,
        receiptHeader: shopSettings.receipt_header,
        receiptFooter: shopSettings.receipt_footer,
        currencySymbol: shopSettings.currency_symbol,
        primaryColor: shopSettings.primary_color,
        phone: shopSettings.phone,
        email: shopSettings.email,
        address: shopSettings.address,
      };

      const receiptDataForPrint: ReceiptData = {
        receiptNumber: receiptData,
        date: new Date(),
        branchName: branch.name,
        branchAddress: branch.address || '',
        cashierName: user?.email || 'Cashier',
        items: cart.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          total: item.total,
          isBulk: item.is_bulk_price,
        })),
        subtotal,
        taxAmount,
        taxLines: taxResult.lines,
        total,
        cashReceived: received,
        change: changeAmount,
        branding,
      };

      setLastSaleData(receiptDataForPrint);
      setShowPaymentDialog(false);
      setShowReceiptDialog(true);
      
      toast.success(`Sale completed! Receipt: ${receiptData}`);
      setCashReceived('');
      clearCart();
      fetchProducts();
    } catch (error: any) {
      console.error('Error processing payment:', error);
      toast.error(error?.message || 'Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle print receipt
  const handlePrintReceipt = async (type: 'thermal' | 'pdf') => {
    if (!lastSaleData) return;
    
    try {
      if (type === 'thermal') {
        await printThermalReceipt(lastSaleData);
        toast.success('Sent to thermal printer');
      } else {
        await generateReceiptPDF(lastSaleData);
        toast.success('PDF downloaded');
      }
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print receipt');
    }
  };

  // Quick cash buttons
  const quickCashAmounts = [10, 20, 50, 100, 200, 500];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex bg-gradient-to-br from-background via-background to-muted/30">
      {/* Products panel */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Search bar */}
        <div className="mb-4">
          <div className="flex gap-2">
            <div className="relative group flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                ref={searchInputRef}
                placeholder="Search by name, SKU, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-12 h-14 text-lg rounded-xl border-2 border-transparent bg-card shadow-sm focus:border-primary focus:shadow-md transition-all duration-300"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-6 rounded-xl"
              onClick={() => setShowBarcodeScanner(true)}
            >
              <Barcode className="h-5 w-5 mr-2" />
              Scan
            </Button>
            <div className="flex rounded-xl border bg-card p-1 gap-1">
              {([['grid', LayoutGrid], ['list', List], ['compact', Grid3X3]] as const).map(([m, Icon]) => (
                <Button key={m} variant={viewMode === m ? 'default' : 'ghost'} size="icon" className="h-12 w-12" title={m} onClick={() => changeView(m)}>
                  <Icon className="h-5 w-5" />
                </Button>
              ))}
            </div>
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
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' : viewMode === 'compact' ? 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2' : 'flex flex-col gap-2'}>
              {productPage.pageItems.map((product) => {
                const stock = product.branch_inventory?.[0]?.quantity || 0;
                const inCart = cart.find((item) => item.product.id === product.id);
                const bulkInfo = getBulkPriceInfo(product);
                const isList = viewMode === 'list';
                
                return (
                  <div
                    key={product.id}
                    className={`${viewMode === 'grid' ? 'p-4' : 'p-2'} rounded-xl border-2 border-transparent bg-card text-left hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 relative group ${isList ? 'flex items-center gap-3' : ''}`}
                  >
                    {inCart && (
                      <Badge className="absolute -top-2 -right-2 h-7 w-7 flex items-center justify-center p-0 rounded-full bg-primary shadow-lg animate-scale-in">
                        {inCart.quantity}
                      </Badge>
                    )}
                    <button
                      onClick={() => quickAddToCart(product)}
                      disabled={stock <= 0}
                      className={`w-full text-left disabled:opacity-50 disabled:cursor-not-allowed ${isList ? 'flex items-center gap-3' : ''}`}
                    >
                      {viewMode === 'grid' && (
                        <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <Package className="h-10 w-10 text-muted-foreground/50" />
                          )}
                        </div>
                      )}
                      <div className={isList ? 'flex-1 min-w-0' : ''}>
                        <p className="font-semibold text-sm truncate">{product.name}</p>
                        {product.expired_qty ? (
                          <Badge variant="destructive" className="mt-1 text-[10px]">{product.expired_qty} expired</Badge>
                        ) : null}
                        <p className="text-xs text-muted-foreground truncate">{product.sku}</p>
                      </div>
                      <div className={`flex items-center justify-between gap-3 ${isList ? '' : 'mt-2'}`}>
                        <span className={`font-bold text-primary ${viewMode === 'grid' ? 'text-lg' : 'text-sm'}`}>{formatPrice(product.retail_price)}</span>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${stock <= product.min_stock_level ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                          {stock}
                        </span>
                      </div>
                    </button>
                    {bulkInfo && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className={`${isList ? 'shrink-0' : 'w-full mt-2'} text-xs font-medium bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 border-0`}
                        onClick={() => openAddToCartDialog(product)}
                        disabled={stock <= 0}
                      >
                        Bulk: {formatPrice(bulkInfo.price)} (≥{bulkInfo.minQty})
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <PaginationBar {...productPage} />
      </div>

      {/* Cart panel */}
      <div className="w-96 border-l bg-gradient-to-b from-card to-card/95 flex flex-col shadow-xl">
        <div className="p-4 border-b bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              Cart
              {cart.length > 0 && (
                <Badge className="bg-primary text-primary-foreground">{cart.length}</Badge>
              )}
            </h2>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart} className="text-muted-foreground hover:text-destructive">
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
                        {formatPrice(item.unit_price)}
                      </span>
                      {item.is_bulk_price ? (
                        <Badge 
                          variant="outline" 
                          className="text-xs cursor-pointer bg-primary/10"
                          onClick={() => togglePricingType(index)}
                        >
                          Bulk ✓
                        </Badge>
                      ) : item.product.bulk_pricing_tiers?.length ? (
                        <Badge 
                          variant="outline" 
                          className="text-xs cursor-pointer"
                          onClick={() => togglePricingType(index)}
                        >
                          Retail
                        </Badge>
                      ) : null}
                    </div>
                    <p className="font-semibold mt-1">{formatPrice(item.total)}</p>
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
              <span>{formatPrice(subtotal)}</span>
            </div>
            {taxResult.lines.map((l) => (
              <div key={l.code} className="flex justify-between">
                <span className="text-muted-foreground">{l.code} ({l.rate}%)</span>
                <span>{formatPrice(l.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Tax ({taxResult.effectiveRate}%)</span>
              <span>{formatPrice(taxAmount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>

          <Button
            className="w-full h-14 text-lg"
            size="lg"
            disabled={cart.length === 0}
            onClick={() => setShowPaymentDialog(true)}
          >
            <DollarSign className="mr-2 h-5 w-5" />
            Pay {formatPrice(total)}
          </Button>
        </div>
      </div>

      {/* Add to cart dialog */}
      <Dialog open={showAddToCartDialog} onOpenChange={setShowAddToCartDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Cart</DialogTitle>
            <DialogDescription>
              {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Quantity</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setAddQuantity(Math.max(1, addQuantity - 1))}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min="1"
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setAddQuantity(addQuantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {selectedProduct?.bulk_pricing_tiers?.length > 0 && (
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div>
                  <Label>Use Bulk Pricing</Label>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(getBulkPriceInfo(selectedProduct)?.price || 0)}/unit
                  </p>
                </div>
                <Switch
                  checked={useBulkPricing}
                  onCheckedChange={setUseBulkPricing}
                />
              </div>
            )}

            <div className="p-4 rounded-lg bg-muted">
              <div className="flex justify-between text-sm">
                <span>Unit Price:</span>
                <span className="font-medium">
                  {formatPrice(useBulkPricing && selectedProduct
                    ? getEffectivePrice(selectedProduct, addQuantity, true).price
                    : selectedProduct?.retail_price || 0
                  )}
                </span>
              </div>
              <div className="flex justify-between font-bold mt-2">
                <span>Total:</span>
                <span>
                  {formatPrice((useBulkPricing && selectedProduct
                    ? getEffectivePrice(selectedProduct, addQuantity, true).price
                    : selectedProduct?.retail_price || 0
                  ) * addQuantity)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddToCartDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAddToCart}>
              Add to Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Cash Payment
            </DialogTitle>
            <DialogDescription>
              Total amount: <span className="font-bold text-foreground">{formatPrice(total)}</span>
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
                  {symbol}{amount}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setCashReceived(total.toFixed(2))}
            >
              Exact Amount ({formatPrice(total)})
            </Button>

            {parseFloat(cashReceived || '0') >= total && (
              <div className="p-4 rounded-lg bg-success/10 text-center">
                <p className="text-sm text-muted-foreground">Change to give</p>
                <p className="text-3xl font-bold text-success">{formatPrice(changeAmount)}</p>
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

      {/* Receipt dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Print Receipt
            </DialogTitle>
            <DialogDescription>
              Receipt #{lastSaleData?.receiptNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted text-center">
              <p className="text-2xl font-bold text-success">Sale Complete!</p>
              <p className="text-muted-foreground">Total: {formatPrice(lastSaleData?.total || 0)}</p>
              {lastSaleData && lastSaleData.change > 0 && (
                <p className="text-muted-foreground">Change: {formatPrice(lastSaleData.change)}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => handlePrintReceipt('thermal')}
              >
                <Printer className="mr-2 h-4 w-4" />
                Thermal Print
              </Button>
              <Button
                variant="outline"
                onClick={() => handlePrintReceipt('pdf')}
              >
                <Receipt className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowReceiptDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onBarcodeScanned={(barcode) => {
          handleBarcodeScanned(barcode);
          setShowBarcodeScanner(false);
        }}
      />
    </div>
  );
}
