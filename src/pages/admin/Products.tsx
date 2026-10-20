import { useCurrency } from '@/hooks/useCurrency';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PaginationBar, usePagination } from '@/components/PaginationBar';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

function resizeImage(file: File, max = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
import {
  Plus,
  Loader2,
  Package,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  DollarSign,
} from 'lucide-react';
import type { Product, Category, Supplier, UnitOfMeasure, BulkPricingTier } from '@/types/database';

export default function Products() {
  const { formatPrice } = useCurrency();
  const { hasRole } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [pricingProduct, setPricingProduct] = useState<Product | null>(null);
  const [pricingTiers, setPricingTiers] = useState<BulkPricingTier[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    description: '',
    category_id: '',
    supplier_id: '',
    unit: 'pcs' as UnitOfMeasure,
    retail_price: 0,
    cost_price: 0,
    shelf_life_days: '' as number | '',
    image_url: '',
    tax_rate: 0,
    is_bulk_item: false,
    min_stock_level: 10,
    max_stock_level: 1000,
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [productsRes, categoriesRes, suppliersRes] = await Promise.all([
        supabase
          .from('products')
          .select('*, category:categories(*), supplier:suppliers(*), bulk_pricing_tiers(*)')
          .order('name'),
        supabase.from('categories').select('*').eq('is_active', true).order('name'),
        supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (suppliersRes.error) throw suppliersRes.error;

      setProducts(productsRes.data as Product[]);
      setCategories(categoriesRes.data as Category[]);
      setSuppliers(suppliersRes.data as Supplier[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query) ||
      product.barcode?.toLowerCase().includes(query)
    );
  });
  const pg = usePagination(filteredProducts);

  const resetForm = () => {
    setFormData({
      sku: '',
      barcode: '',
      name: '',
      description: '',
      category_id: '',
      supplier_id: '',
      unit: 'pcs',
      retail_price: 0,
      cost_price: 0,
      shelf_life_days: '' as number | '',
      image_url: '',
      tax_rate: 0,
      is_bulk_item: false,
      min_stock_level: 10,
      max_stock_level: 1000,
      is_active: true,
    });
    setEditingProduct(null);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      barcode: product.barcode || '',
      name: product.name,
      description: product.description || '',
      category_id: product.category_id || '',
      supplier_id: product.supplier_id || '',
      unit: product.unit,
      retail_price: product.retail_price,
      cost_price: product.cost_price,
      shelf_life_days: ((product as any).shelf_life_days ?? '') as number | '',
      image_url: product.image_url || '',
      tax_rate: product.tax_rate,
      is_bulk_item: product.is_bulk_item,
      min_stock_level: product.min_stock_level,
      max_stock_level: product.max_stock_level,
      is_active: product.is_active,
    });
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.sku || !formData.name) {
      toast.error('SKU and name are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
        barcode: formData.barcode || null,
        description: formData.description || null,
        image_url: formData.image_url || null,
        shelf_life_days: formData.shelf_life_days === '' ? null : Number(formData.shelf_life_days),
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast.success('Product updated');
      } else {
        const { error } = await supabase.from('products').insert(payload);

        if (error) {
          if (error.code === '23505') {
            toast.error('SKU or barcode already exists');
            return;
          }
          throw error;
        }
        toast.success('Product created');
      }

      setShowDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

    try {
      const { error } = await supabase.from('products').delete().eq('id', product.id);
      if (error) throw error;
      toast.success('Product deleted');
      fetchData();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const openPricingDialog = (product: Product) => {
    setPricingProduct(product);
    setPricingTiers(product.bulk_pricing_tiers || []);
    setShowPricingDialog(true);
  };

  const addPricingTier = () => {
    setPricingTiers([
      ...pricingTiers,
      {
        id: `temp-${Date.now()}`,
        product_id: pricingProduct!.id,
        min_quantity: 10,
        max_quantity: undefined,
        price: pricingProduct!.retail_price * 0.9,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  };

  const updatePricingTier = (index: number, field: keyof BulkPricingTier, value: number | undefined) => {
    const updated = [...pricingTiers];
    updated[index] = { ...updated[index], [field]: value };
    setPricingTiers(updated);
  };

  const removePricingTier = (index: number) => {
    setPricingTiers(pricingTiers.filter((_, i) => i !== index));
  };

  const savePricingTiers = async () => {
    if (!pricingProduct) return;

    setIsSubmitting(true);
    try {
      // Delete existing tiers
      await supabase
        .from('bulk_pricing_tiers')
        .delete()
        .eq('product_id', pricingProduct.id);

      // Insert new tiers
      if (pricingTiers.length > 0) {
        const tiersToInsert = pricingTiers.map((tier) => ({
          product_id: pricingProduct.id,
          min_quantity: tier.min_quantity,
          max_quantity: tier.max_quantity || null,
          price: tier.price,
          is_active: tier.is_active,
        }));

        const { error } = await supabase.from('bulk_pricing_tiers').insert(tiersToInsert);
        if (error) throw error;
      }

      toast.success('Pricing tiers saved');
      setShowPricingDialog(false);
      fetchData();
    } catch (error) {
      console.error('Error saving pricing tiers:', error);
      toast.error('Failed to save pricing tiers');
    } finally {
      setIsSubmitting(false);
    }
  };

  const unitOptions: { value: UnitOfMeasure; label: string }[] = [
    { value: 'pcs', label: 'Pieces' },
    { value: 'kg', label: 'Kilograms' },
    { value: 'g', label: 'Grams' },
    { value: 'l', label: 'Liters' },
    { value: 'ml', label: 'Milliliters' },
    { value: 'box', label: 'Box' },
    { value: 'pack', label: 'Pack' },
    { value: 'dozen', label: 'Dozen' },
  ];

  const canManage = hasRole('admin');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        {canManage && (
          <Dialog open={showDialog} onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </DialogTitle>
                <DialogDescription>
                  {editingProduct
                    ? 'Update product information'
                    : 'Create a new product in the catalog'}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU *</Label>
                      <Input
                        id="sku"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        placeholder="PRD-001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="barcode">Barcode</Label>
                      <Input
                        id="barcode"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        placeholder="1234567890123"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Product Image</Label>
                    <div className="flex items-center gap-3">
                      <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
                        {formData.image_url ? <img src={formData.image_url} alt="Product" className="h-full w-full object-cover" /> : <Package className="h-8 w-8 text-muted-foreground" />}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Input type="file" accept="image/*" className="w-60" onChange={async (e) => {
                          const file = e.target.files?.[0]; if (!file) return;
                          if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
                          try { setFormData((f) => ({ ...f, image_url: '' })); const url = await resizeImage(file); setFormData((f) => ({ ...f, image_url: url })); }
                          catch { toast.error('Could not read image'); }
                        }} />
                        {formData.image_url && <Button type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, image_url: '' })}>Remove image</Button>}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Product Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Product name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Product description"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={formData.category_id}
                        onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supplier">Supplier</Label>
                      <Select
                        value={formData.supplier_id}
                        onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="unit">Unit</Label>
                      <Select
                        value={formData.unit}
                        onValueChange={(value) => setFormData({ ...formData, unit: value as UnitOfMeasure })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {unitOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="retail_price">Retail Price</Label>
                      <Input
                        id="retail_price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.retail_price}
                        onChange={(e) => setFormData({ ...formData, retail_price: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cost_price">Cost Price</Label>
                      <Input
                        id="cost_price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.cost_price}
                        onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shelf_life_days">Shelf Life (days)</Label>
                      <Input id="shelf_life_days" type="number" min="0" value={formData.shelf_life_days}
                        onChange={(e) => setFormData({ ...formData, shelf_life_days: e.target.value === '' ? '' : parseInt(e.target.value) })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                      <Input
                        id="tax_rate"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.tax_rate}
                        onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="min_stock">Min Stock</Label>
                      <Input
                        id="min_stock"
                        type="number"
                        min="0"
                        value={formData.min_stock_level}
                        onChange={(e) => setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_stock">Max Stock</Label>
                      <Input
                        id="max_stock"
                        type="number"
                        min="0"
                        value={formData.max_stock_level}
                        onChange={(e) => setFormData({ ...formData, max_stock_level: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_bulk_item"
                        checked={formData.is_bulk_item}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_bulk_item: checked })}
                      />
                      <Label htmlFor="is_bulk_item">Bulk Item</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                      <Label htmlFor="is_active">Active</Label>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingProduct ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Products table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {searchQuery ? 'No products found' : 'No products yet'}
          </p>
          {canManage && !searchQuery && (
            <Button className="mt-4" onClick={() => setShowDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add your first product
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-center">Bulk Pricing</TableHead>
                <TableHead className="text-center">Status</TableHead>
                {canManage && <TableHead className="w-[70px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.pageItems.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full rounded-lg object-cover"
                          />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.barcode && (
                          <p className="text-xs text-muted-foreground">{product.barcode}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                  <TableCell>{product.category?.name || '—'}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPrice(product.retail_price)}
                    {product.cost_price > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Cost: {formatPrice(product.cost_price)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {product.bulk_pricing_tiers && product.bulk_pricing_tiers.length > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPricingDialog(product)}
                      >
                        <DollarSign className="h-3 w-3 mr-1" />
                        {product.bulk_pricing_tiers.length} tier
                        {product.bulk_pricing_tiers.length > 1 ? 's' : ''}
                      </Button>
                    ) : canManage ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openPricingDialog(product)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={product.is_active ? 'default' : 'secondary'}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(product)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openPricingDialog(product)}>
                            <DollarSign className="mr-2 h-4 w-4" />
                            Bulk Pricing
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(product)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar {...pg} />
        </div>
      )}

      {/* Bulk Pricing Dialog */}
      <Dialog open={showPricingDialog} onOpenChange={setShowPricingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Pricing Tiers</DialogTitle>
            <DialogDescription>
              Set quantity-based pricing for {pricingProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {pricingTiers.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No pricing tiers configured
              </p>
            ) : (
              <div className="space-y-3">
                {pricingTiers.map((tier, index) => (
                  <div key={tier.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Min Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={tier.min_quantity}
                          onChange={(e) =>
                            updatePricingTier(index, 'min_quantity', parseInt(e.target.value) || 1)
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Max Qty</Label>
                        <Input
                          type="number"
                          min={tier.min_quantity}
                          value={tier.max_quantity || ''}
                          placeholder="∞"
                          onChange={(e) =>
                            updatePricingTier(
                              index,
                              'max_quantity',
                              e.target.value ? parseInt(e.target.value) : undefined
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tier.price}
                          onChange={(e) =>
                            updatePricingTier(index, 'price', parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePricingTier(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={addPricingTier}>
              <Plus className="mr-2 h-4 w-4" />
              Add Tier
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPricingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={savePricingTiers} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Tiers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
