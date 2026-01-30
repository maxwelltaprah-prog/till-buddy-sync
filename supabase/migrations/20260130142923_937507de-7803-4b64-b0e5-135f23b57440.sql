-- =============================================
-- ENTERPRISE SUPERMARKET POS SYSTEM - FOUNDATION SCHEMA
-- =============================================

-- 1. ENUMS
-- =============================================

-- User roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'branch_supervisor', 'stock_manager', 'cashier');

-- Unit of measure enum
CREATE TYPE public.unit_of_measure AS ENUM ('pcs', 'kg', 'g', 'l', 'ml', 'box', 'pack', 'dozen');

-- Stock operation type enum
CREATE TYPE public.stock_operation_type AS ENUM ('receive', 'sale', 'return', 'adjustment', 'transfer_in', 'transfer_out');

-- Transaction status enum
CREATE TYPE public.transaction_status AS ENUM ('pending', 'completed', 'voided', 'suspended', 'refunded');

-- Audit action enum
CREATE TYPE public.audit_action AS ENUM ('create', 'update', 'delete', 'login', 'logout', 'void', 'refund', 'price_override', 'discount_apply');

-- 2. BRANCHES TABLE
-- =============================================

CREATE TABLE public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  email TEXT,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  operating_hours JSONB DEFAULT '{"open": "08:00", "close": "21:00"}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. USER PROFILES TABLE
-- =============================================

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  branch_id UUID REFERENCES public.branches(id),
  is_active BOOLEAN DEFAULT true,
  pin_code TEXT, -- For quick cashier login
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. USER ROLES TABLE (Separate table for security)
-- =============================================

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- 5. CATEGORIES TABLE
-- =============================================

CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.categories(id),
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. SUPPLIERS TABLE
-- =============================================

CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  payment_terms TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. PRODUCTS TABLE
-- =============================================

CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  unit public.unit_of_measure DEFAULT 'pcs',
  retail_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  is_bulk_item BOOLEAN DEFAULT false,
  min_stock_level INTEGER DEFAULT 10,
  max_stock_level INTEGER DEFAULT 1000,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. BULK PRICING TIERS TABLE
-- =============================================

CREATE TABLE public.bulk_pricing_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  min_quantity INTEGER NOT NULL,
  max_quantity INTEGER,
  price DECIMAL(12,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_quantity_range CHECK (max_quantity IS NULL OR max_quantity >= min_quantity)
);

-- 9. BRANCH INVENTORY TABLE
-- =============================================

CREATE TABLE public.branch_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(12,3) DEFAULT 0,
  reserved_quantity DECIMAL(12,3) DEFAULT 0,
  last_restocked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(branch_id, product_id)
);

-- 10. STOCK MOVEMENTS TABLE
-- =============================================

CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id) NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  operation_type public.stock_operation_type NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  reference_id UUID, -- Links to sale, transfer, PO, etc.
  reference_type TEXT,
  reason TEXT,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 11. SALES/TRANSACTIONS TABLE
-- =============================================

CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  branch_id UUID REFERENCES public.branches(id) NOT NULL,
  cashier_id UUID REFERENCES auth.users(id) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  discount_reason TEXT,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  cash_received DECIMAL(12,2) DEFAULT 0,
  change_given DECIMAL(12,2) DEFAULT 0,
  status public.transaction_status DEFAULT 'pending',
  voided_by UUID REFERENCES auth.users(id),
  voided_at TIMESTAMP WITH TIME ZONE,
  void_reason TEXT,
  original_sale_id UUID REFERENCES public.sales(id), -- For refunds
  is_synced BOOLEAN DEFAULT true,
  local_id TEXT, -- For offline transactions
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 12. SALE ITEMS TABLE
-- =============================================

CREATE TABLE public.sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  product_name TEXT NOT NULL, -- Snapshot for historical record
  quantity DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  is_bulk_price BOOLEAN DEFAULT false,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 13. SUSPENDED SALES TABLE
-- =============================================

CREATE TABLE public.suspended_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id) NOT NULL,
  cashier_id UUID REFERENCES auth.users(id) NOT NULL,
  cart_data JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '24 hours')
);

-- 14. RETURNS TABLE
-- =============================================

CREATE TABLE public.returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_number TEXT NOT NULL UNIQUE,
  original_sale_id UUID REFERENCES public.sales(id) NOT NULL,
  branch_id UUID REFERENCES public.branches(id) NOT NULL,
  processed_by UUID REFERENCES auth.users(id) NOT NULL,
  approved_by UUID REFERENCES auth.users(id),
  total_refund DECIMAL(12,2) NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 15. RETURN ITEMS TABLE
-- =============================================

CREATE TABLE public.return_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID REFERENCES public.returns(id) ON DELETE CASCADE NOT NULL,
  sale_item_id UUID REFERENCES public.sale_items(id) NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  refund_amount DECIMAL(12,2) NOT NULL,
  restock BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 16. AUDIT LOGS TABLE
-- =============================================

CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  branch_id UUID REFERENCES public.branches(id),
  action public.audit_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 17. SYSTEM SETTINGS TABLE
-- =============================================

CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_branch_id ON public.profiles(branch_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_sku ON public.products(sku);
CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_branch_inventory_branch ON public.branch_inventory(branch_id);
CREATE INDEX idx_branch_inventory_product ON public.branch_inventory(product_id);
CREATE INDEX idx_sales_branch ON public.sales(branch_id);
CREATE INDEX idx_sales_cashier ON public.sales(cashier_id);
CREATE INDEX idx_sales_receipt ON public.sales(receipt_number);
CREATE INDEX idx_sales_created ON public.sales(created_at DESC);
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX idx_stock_movements_branch ON public.stock_movements(branch_id);
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_categories_parent ON public.categories(parent_id);
CREATE INDEX idx_bulk_pricing_product ON public.bulk_pricing_tiers(product_id);

-- =============================================
-- SECURITY DEFINER FUNCTION FOR ROLE CHECK
-- =============================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any of the specified roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- Function to get user's branch
CREATE OR REPLACE FUNCTION public.get_user_branch(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.profiles WHERE user_id = _user_id
$$;

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspended_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- BRANCHES POLICIES
CREATE POLICY "Branches viewable by authenticated users" ON public.branches
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Branches manageable by admins" ON public.branches
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PROFILES POLICIES
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- USER ROLES POLICIES
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- CATEGORIES POLICIES
CREATE POLICY "Categories viewable by authenticated users" ON public.categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Categories manageable by admins" ON public.categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- SUPPLIERS POLICIES
CREATE POLICY "Suppliers viewable by authenticated users" ON public.suppliers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Suppliers manageable by admins and stock managers" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'stock_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'stock_manager']::app_role[]));

-- PRODUCTS POLICIES
CREATE POLICY "Products viewable by authenticated users" ON public.products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Products manageable by admins" ON public.products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- BULK PRICING POLICIES
CREATE POLICY "Bulk pricing viewable by authenticated users" ON public.bulk_pricing_tiers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Bulk pricing manageable by admins" ON public.bulk_pricing_tiers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- BRANCH INVENTORY POLICIES
CREATE POLICY "Inventory viewable by authenticated users" ON public.branch_inventory
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Inventory manageable by admins and stock managers" ON public.branch_inventory
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'stock_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'stock_manager']::app_role[]));

-- STOCK MOVEMENTS POLICIES
CREATE POLICY "Stock movements viewable by relevant roles" ON public.stock_movements
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'stock_manager', 'branch_supervisor']::app_role[]));

CREATE POLICY "Stock movements insertable by relevant roles" ON public.stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'stock_manager', 'cashier']::app_role[]));

-- SALES POLICIES
CREATE POLICY "Cashiers can view own sales" ON public.sales
  FOR SELECT TO authenticated
  USING (cashier_id = auth.uid() OR 
         public.has_any_role(auth.uid(), ARRAY['admin', 'branch_supervisor']::app_role[]));

CREATE POLICY "Cashiers can create sales" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'cashier']::app_role[]));

CREATE POLICY "Sales updatable by relevant roles" ON public.sales
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'cashier', 'branch_supervisor']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'cashier', 'branch_supervisor']::app_role[]));

-- SALE ITEMS POLICIES
CREATE POLICY "Sale items viewable with sales" ON public.sale_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sale items insertable by cashiers" ON public.sale_items
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'cashier']::app_role[]));

-- SUSPENDED SALES POLICIES
CREATE POLICY "Suspended sales viewable by branch" ON public.suspended_sales
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Suspended sales manageable by cashiers" ON public.suspended_sales
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'cashier']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'cashier']::app_role[]));

-- RETURNS POLICIES
CREATE POLICY "Returns viewable by relevant roles" ON public.returns
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'cashier', 'branch_supervisor']::app_role[]));

CREATE POLICY "Returns insertable by cashiers" ON public.returns
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'cashier']::app_role[]));

-- RETURN ITEMS POLICIES
CREATE POLICY "Return items viewable with returns" ON public.return_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Return items insertable by cashiers" ON public.return_items
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'cashier']::app_role[]));

-- AUDIT LOGS POLICIES
CREATE POLICY "Audit logs viewable by admins" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Audit logs insertable by all authenticated" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- SYSTEM SETTINGS POLICIES
CREATE POLICY "Settings viewable by authenticated users" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Settings manageable by admins" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bulk_pricing_updated_at BEFORE UPDATE ON public.bulk_pricing_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_branch_inventory_updated_at BEFORE UPDATE ON public.branch_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Generate receipt number
CREATE OR REPLACE FUNCTION public.generate_receipt_number(branch_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  today_date TEXT;
  seq_num INTEGER;
  receipt TEXT;
BEGIN
  today_date := TO_CHAR(NOW(), 'YYYYMMDD');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(receipt_number FROM LENGTH(branch_code) + 10) AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM public.sales
  WHERE receipt_number LIKE branch_code || '-' || today_date || '-%';
  
  receipt := branch_code || '-' || today_date || '-' || LPAD(seq_num::TEXT, 5, '0');
  RETURN receipt;
END;
$$;

-- Generate return number
CREATE OR REPLACE FUNCTION public.generate_return_number(branch_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  today_date TEXT;
  seq_num INTEGER;
  return_num TEXT;
BEGIN
  today_date := TO_CHAR(NOW(), 'YYYYMMDD');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(return_number FROM LENGTH(branch_code) + 12) AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM public.returns
  WHERE return_number LIKE 'R-' || branch_code || '-' || today_date || '-%';
  
  return_num := 'R-' || branch_code || '-' || today_date || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN return_num;
END;
$$;

-- Get effective price for a product based on quantity
CREATE OR REPLACE FUNCTION public.get_effective_price(
  _product_id UUID,
  _quantity DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  bulk_price DECIMAL;
  retail_price DECIMAL;
BEGIN
  -- Get retail price
  SELECT p.retail_price INTO retail_price
  FROM public.products p
  WHERE p.id = _product_id;
  
  -- Check for applicable bulk pricing
  SELECT bpt.price INTO bulk_price
  FROM public.bulk_pricing_tiers bpt
  WHERE bpt.product_id = _product_id
    AND bpt.is_active = true
    AND bpt.min_quantity <= _quantity
    AND (bpt.max_quantity IS NULL OR bpt.max_quantity >= _quantity)
  ORDER BY bpt.min_quantity DESC
  LIMIT 1;
  
  -- Return bulk price if available, otherwise retail
  RETURN COALESCE(bulk_price, retail_price);
END;
$$;