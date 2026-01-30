// Database types for the POS system

export type AppRole = 'admin' | 'branch_supervisor' | 'stock_manager' | 'cashier';

export type UnitOfMeasure = 'pcs' | 'kg' | 'g' | 'l' | 'ml' | 'box' | 'pack' | 'dozen';

export type StockOperationType = 'receive' | 'sale' | 'return' | 'adjustment' | 'transfer_in' | 'transfer_out';

export type TransactionStatus = 'pending' | 'completed' | 'voided' | 'suspended' | 'refunded';

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'void' | 'refund' | 'price_override' | 'discount_apply';

export interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  tax_rate: number;
  is_active: boolean;
  operating_hours: {
    open: string;
    close: string;
  };
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  branch_id?: string;
  is_active: boolean;
  pin_code?: string;
  created_at: string;
  updated_at: string;
  branch?: Branch;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  image_url?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  children?: Category[];
}

export interface Supplier {
  id: string;
  name: string;
  code?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  payment_terms?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  category_id?: string;
  supplier_id?: string;
  unit: UnitOfMeasure;
  retail_price: number;
  cost_price: number;
  tax_rate: number;
  is_bulk_item: boolean;
  min_stock_level: number;
  max_stock_level: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: Category;
  supplier?: Supplier;
  bulk_pricing_tiers?: BulkPricingTier[];
}

export interface BulkPricingTier {
  id: string;
  product_id: string;
  min_quantity: number;
  max_quantity?: number;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchInventory {
  id: string;
  branch_id: string;
  product_id: string;
  quantity: number;
  reserved_quantity: number;
  last_restocked_at?: string;
  created_at: string;
  updated_at: string;
  product?: Product;
  branch?: Branch;
}

export interface StockMovement {
  id: string;
  branch_id: string;
  product_id: string;
  operation_type: StockOperationType;
  quantity: number;
  reference_id?: string;
  reference_type?: string;
  reason?: string;
  performed_by?: string;
  created_at: string;
}

export interface Sale {
  id: string;
  receipt_number: string;
  branch_id: string;
  cashier_id: string;
  subtotal: number;
  discount_amount: number;
  discount_reason?: string;
  tax_amount: number;
  total: number;
  cash_received: number;
  change_given: number;
  status: TransactionStatus;
  voided_by?: string;
  voided_at?: string;
  void_reason?: string;
  original_sale_id?: string;
  is_synced: boolean;
  local_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  is_bulk_price: boolean;
  discount_amount: number;
  tax_amount: number;
  total: number;
  created_at: string;
}

export interface SuspendedSale {
  id: string;
  branch_id: string;
  cashier_id: string;
  cart_data: CartData;
  notes?: string;
  created_at: string;
  expires_at: string;
}

export interface CartData {
  items: CartItem[];
  subtotal: number;
  discount_amount: number;
  discount_reason?: string;
  tax_amount: number;
  total: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  is_bulk_price: boolean;
  discount_amount: number;
  total: number;
}

export interface Return {
  id: string;
  return_number: string;
  original_sale_id: string;
  branch_id: string;
  processed_by: string;
  approved_by?: string;
  total_refund: number;
  reason: string;
  notes?: string;
  created_at: string;
  items?: ReturnItem[];
}

export interface ReturnItem {
  id: string;
  return_id: string;
  sale_item_id: string;
  product_id: string;
  quantity: number;
  refund_amount: number;
  restock: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  branch_id?: string;
  action: AuditAction;
  entity_type: string;
  entity_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: unknown;
  description?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

// Role permissions mapping
export const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  admin: [
    'manage_users',
    'manage_products',
    'manage_inventory',
    'manage_branches',
    'manage_suppliers',
    'manage_categories',
    'view_all_reports',
    'manage_settings',
    'process_sales',
    'process_returns',
    'void_transactions',
    'apply_discounts',
    'price_override',
  ],
  branch_supervisor: [
    'view_branch_reports',
    'approve_transactions',
    'view_inventory',
    'view_cashier_performance',
  ],
  stock_manager: [
    'receive_inventory',
    'transfer_stock',
    'adjust_inventory',
    'view_stock_reports',
    'manage_suppliers',
  ],
  cashier: [
    'process_sales',
    'process_returns',
    'suspend_resume_sales',
    'view_own_sales',
    'apply_basic_discounts',
  ],
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrator',
  branch_supervisor: 'Branch Supervisor',
  stock_manager: 'Stock Manager',
  cashier: 'Cashier',
};
