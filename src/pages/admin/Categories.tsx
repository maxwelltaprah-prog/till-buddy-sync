import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus,
  Loader2,
  Grid3X3,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderTree,
} from 'lucide-react';
import type { Category } from '@/types/database';

export default function Categories() {
  const { hasRole } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parent_id: '',
    sort_order: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order')
        .order('name');

      if (error) throw error;
      setCategories(data as Category[]);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCategories = categories.filter((category) => {
    if (!searchQuery) return true;
    return category.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Build category tree
  const getCategoryTree = () => {
    const topLevel = filteredCategories.filter((c) => !c.parent_id);
    const getChildren = (parentId: string): Category[] => {
      return filteredCategories
        .filter((c) => c.parent_id === parentId)
        .map((c) => ({ ...c, children: getChildren(c.id) }));
    };
    return topLevel.map((c) => ({ ...c, children: getChildren(c.id) }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      parent_id: '',
      sort_order: 0,
      is_active: true,
    });
    setEditingCategory(null);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      parent_id: category.parent_id || '',
      sort_order: category.sort_order,
      is_active: category.is_active,
    });
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('Name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        description: formData.description || null,
        parent_id: formData.parent_id || null,
      };

      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update(payload)
          .eq('id', editingCategory.id);

        if (error) throw error;
        toast.success('Category updated');
      } else {
        const { error } = await supabase.from('categories').insert(payload);

        if (error) throw error;
        toast.success('Category created');
      }

      setShowDialog(false);
      resetForm();
      fetchCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (category: Category) => {
    // Check if category has children
    const hasChildren = categories.some((c) => c.parent_id === category.id);
    if (hasChildren) {
      toast.error('Cannot delete category with subcategories');
      return;
    }

    if (!confirm(`Delete "${category.name}"? This cannot be undone.`)) return;

    try {
      const { error } = await supabase.from('categories').delete().eq('id', category.id);
      if (error) throw error;
      toast.success('Category deleted');
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category. It may have associated products.');
    }
  };

  const getParentName = (parentId: string | undefined): string => {
    if (!parentId) return '—';
    const parent = categories.find((c) => c.id === parentId);
    return parent?.name || '—';
  };

  const canManage = hasRole('admin');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Categories</h1>
          <p className="text-muted-foreground">Organize your product catalog</p>
        </div>
        {canManage && (
          <Dialog open={showDialog} onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </DialogTitle>
                <DialogDescription>
                  {editingCategory
                    ? 'Update category information'
                    : 'Create a new product category'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Category Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Beverages"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Category description"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parent">Parent Category</Label>
                  <select
                    id="parent"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={formData.parent_id}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  >
                    <option value="">None (Top Level)</option>
                    {categories
                      .filter((c) => c.id !== editingCategory?.id)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sort_order">Sort Order</Label>
                    <Input
                      id="sort_order"
                      type="number"
                      min="0"
                      value={formData.sort_order}
                      onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-6">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label htmlFor="is_active">Active</Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingCategory ? 'Update' : 'Create'}
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
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Categories table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Grid3X3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {searchQuery ? 'No categories found' : 'No categories yet'}
          </p>
          {canManage && !searchQuery && (
            <Button className="mt-4" onClick={() => setShowDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add your first category
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead className="text-center">Sort Order</TableHead>
                <TableHead className="text-center">Status</TableHead>
                {canManage && <TableHead className="w-[70px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCategories.map((category) => {
                const isChild = !!category.parent_id;

                return (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className={`flex items-center gap-3 ${isChild ? 'ml-6' : ''}`}>
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          isChild ? 'bg-muted' : 'bg-primary/10'
                        }`}>
                          {isChild ? (
                            <FolderTree className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <Grid3X3 className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{category.name}</p>
                          {category.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {category.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getParentName(category.parent_id)}
                    </TableCell>
                    <TableCell className="text-center">{category.sort_order}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={category.is_active ? 'default' : 'secondary'}>
                        {category.is_active ? 'Active' : 'Inactive'}
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
                            <DropdownMenuItem onClick={() => openEditDialog(category)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(category)}
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
