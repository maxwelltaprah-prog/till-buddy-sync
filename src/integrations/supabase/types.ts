export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          branch_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          store_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          branch_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          store_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          branch_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          store_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_inventory: {
        Row: {
          branch_id: string
          created_at: string | null
          id: string
          is_available: boolean
          last_restocked_at: string | null
          product_id: string
          quantity: number | null
          reserved_quantity: number | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          id?: string
          is_available?: boolean
          last_restocked_at?: string | null
          product_id: string
          quantity?: number | null
          reserved_quantity?: number | null
          store_id?: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          id?: string
          is_available?: boolean
          last_restocked_at?: string | null
          product_id?: string
          quantity?: number | null
          reserved_quantity?: number | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_inventory_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          code: string
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          location_type: string
          name: string
          operating_hours: Json | null
          phone: string | null
          settings: Json | null
          store_id: string
          tax_rate: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          location_type?: string
          name: string
          operating_hours?: Json | null
          phone?: string | null
          settings?: Json | null
          store_id?: string
          tax_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          location_type?: string
          name?: string
          operating_hours?: Json | null
          phone?: string | null
          settings?: Json | null
          store_id?: string
          tax_rate?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_pricing_tiers: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          max_quantity: number | null
          min_quantity: number
          price: number
          product_id: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_quantity?: number | null
          min_quantity: number
          price: number
          product_id: string
          store_id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_quantity?: number | null
          min_quantity?: number
          price?: number
          product_id?: string
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_pricing_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_pricing_tiers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          sort_order: number | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          sort_order?: number | null
          store_id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          sort_order?: number | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_customers: {
        Row: {
          address: string | null
          branch_id: string | null
          created_at: string
          credit_limit: number
          default_days: number
          email: string | null
          id: string
          id_number: string | null
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          created_at?: string
          credit_limit?: number
          default_days?: number
          email?: string | null
          id?: string
          id_number?: string | null
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          store_id?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          created_at?: string
          credit_limit?: number
          default_days?: number
          email?: string | null
          id?: string
          id_number?: string | null
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_payments: {
        Row: {
          amount: number
          created_at: string
          credit_sale_id: string
          id: string
          notes: string | null
          received_by: string | null
          store_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credit_sale_id: string
          id?: string
          notes?: string | null
          received_by?: string | null
          store_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          credit_sale_id?: string
          id?: string
          notes?: string | null
          received_by?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_payments_credit_sale_id_fkey"
            columns: ["credit_sale_id"]
            isOneToOne: false
            referencedRelation: "credit_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_sales: {
        Row: {
          amount: number
          amount_paid: number
          branch_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          due_date: string
          id: string
          receipt_number: string
          repayment_days: number
          sale_id: string
          store_id: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          due_date: string
          id?: string
          receipt_number: string
          repayment_days: number
          sale_id: string
          store_id?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          due_date?: string
          id?: string
          receipt_number?: string
          repayment_days?: number
          sale_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "credit_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_sales_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_owners: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_batches: {
        Row: {
          batch_number: string | null
          branch_id: string
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          mfg_date: string | null
          product_id: string
          quantity: number
          store_id: string
        }
        Insert: {
          batch_number?: string | null
          branch_id: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          mfg_date?: string | null
          product_id: string
          quantity?: number
          store_id?: string
        }
        Update: {
          batch_number?: string | null
          branch_id?: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          mfg_date?: string | null
          product_id?: string
          quantity?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_bulk_item: boolean | null
          max_stock_level: number | null
          min_stock_level: number | null
          name: string
          retail_price: number
          shelf_life_days: number | null
          sku: string
          store_id: string
          supplier_id: string | null
          tax_rate: number | null
          unit: Database["public"]["Enums"]["unit_of_measure"] | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_bulk_item?: boolean | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          name: string
          retail_price?: number
          shelf_life_days?: number | null
          sku: string
          store_id?: string
          supplier_id?: string | null
          tax_rate?: number | null
          unit?: Database["public"]["Enums"]["unit_of_measure"] | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_bulk_item?: boolean | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          name?: string
          retail_price?: number
          shelf_life_days?: number | null
          sku?: string
          store_id?: string
          supplier_id?: string | null
          tax_rate?: number | null
          unit?: Database["public"]["Enums"]["unit_of_measure"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          branch_id: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          pin_code: string | null
          store_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          pin_code?: string | null
          store_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          pin_code?: string | null
          store_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          refund_amount: number
          restock: boolean | null
          return_id: string
          sale_item_id: string
          store_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          quantity: number
          refund_amount: number
          restock?: boolean | null
          return_id: string
          sale_item_id: string
          store_id?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          refund_amount?: number
          restock?: boolean | null
          return_id?: string
          sale_item_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          approved_by: string | null
          branch_id: string
          created_at: string | null
          id: string
          notes: string | null
          original_sale_id: string
          processed_by: string
          reason: string
          return_number: string
          store_id: string
          total_refund: number
        }
        Insert: {
          approved_by?: string | null
          branch_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          original_sale_id: string
          processed_by: string
          reason: string
          return_number: string
          store_id?: string
          total_refund: number
        }
        Update: {
          approved_by?: string | null
          branch_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          original_sale_id?: string
          processed_by?: string
          reason?: string
          return_number?: string
          store_id?: string
          total_refund?: number
        }
        Relationships: [
          {
            foreignKeyName: "returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_original_sale_id_fkey"
            columns: ["original_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      role_screen_access: {
        Row: {
          enabled: boolean
          role: Database["public"]["Enums"]["app_role"]
          screen: string
          store_id: string
        }
        Insert: {
          enabled: boolean
          role: Database["public"]["Enums"]["app_role"]
          screen: string
          store_id?: string
        }
        Update: {
          enabled?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          screen?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_screen_access_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          cost_price: number | null
          created_at: string | null
          discount_amount: number | null
          id: string
          is_bulk_price: boolean | null
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          store_id: string
          tax_amount: number | null
          tax_breakdown: Json | null
          total: number
          unit_price: number
        }
        Insert: {
          cost_price?: number | null
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          is_bulk_price?: boolean | null
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          store_id?: string
          tax_amount?: number | null
          tax_breakdown?: Json | null
          total: number
          unit_price: number
        }
        Update: {
          cost_price?: number | null
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          is_bulk_price?: boolean | null
          product_id?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          store_id?: string
          tax_amount?: number | null
          tax_breakdown?: Json | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string
          cash_received: number | null
          cashier_id: string
          change_given: number | null
          created_at: string | null
          discount_amount: number | null
          discount_reason: string | null
          id: string
          is_synced: boolean | null
          local_id: string | null
          notes: string | null
          original_sale_id: string | null
          payment_method: string
          receipt_number: string
          status: Database["public"]["Enums"]["transaction_status"] | null
          store_id: string
          subtotal: number
          tax_amount: number | null
          tax_breakdown: Json | null
          total: number
          updated_at: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          branch_id: string
          cash_received?: number | null
          cashier_id: string
          change_given?: number | null
          created_at?: string | null
          discount_amount?: number | null
          discount_reason?: string | null
          id?: string
          is_synced?: boolean | null
          local_id?: string | null
          notes?: string | null
          original_sale_id?: string | null
          payment_method?: string
          receipt_number: string
          status?: Database["public"]["Enums"]["transaction_status"] | null
          store_id?: string
          subtotal?: number
          tax_amount?: number | null
          tax_breakdown?: Json | null
          total?: number
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          branch_id?: string
          cash_received?: number | null
          cashier_id?: string
          change_given?: number | null
          created_at?: string | null
          discount_amount?: number | null
          discount_reason?: string | null
          id?: string
          is_synced?: boolean | null
          local_id?: string | null
          notes?: string | null
          original_sale_id?: string | null
          payment_method?: string
          receipt_number?: string
          status?: Database["public"]["Enums"]["transaction_status"] | null
          store_id?: string
          subtotal?: number
          tax_amount?: number | null
          tax_breakdown?: Json | null
          total?: number
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_original_sale_id_fkey"
            columns: ["original_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          branch_id: string
          created_at: string | null
          id: string
          operation_type: Database["public"]["Enums"]["stock_operation_type"]
          performed_by: string | null
          product_id: string
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          store_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          id?: string
          operation_type: Database["public"]["Enums"]["stock_operation_type"]
          performed_by?: string | null
          product_id: string
          quantity: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          store_id?: string
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          id?: string
          operation_type?: Database["public"]["Enums"]["stock_operation_type"]
          performed_by?: string | null
          product_id?: string
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string
          from_branch_id: string
          id: string
          notes: string | null
          performed_by: string | null
          product_id: string
          quantity: number
          store_id: string
          to_branch_id: string
        }
        Insert: {
          created_at?: string
          from_branch_id: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          product_id: string
          quantity: number
          store_id?: string
          to_branch_id: string
        }
        Update: {
          created_at?: string
          from_branch_id?: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          product_id?: string
          quantity?: number
          store_id?: string
          to_branch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          archived_at: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          code: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          code?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          code?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      suspended_sales: {
        Row: {
          branch_id: string
          cart_data: Json
          cashier_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          notes: string | null
          store_id: string
        }
        Insert: {
          branch_id: string
          cart_data: Json
          cashier_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          store_id?: string
        }
        Update: {
          branch_id?: string
          cart_data?: Json
          cashier_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suspended_sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suspended_sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          store_id: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          store_id?: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          store_id?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_components: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          rate: number
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          rate?: number
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rate?: number
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_components_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bulk_delete_products: {
        Args: { p_ids: string[] }
        Returns: {
          deactivated: number
          deleted: number
        }[]
      }
      create_sale_with_receipt: {
        Args: {
          p_branch_code: string
          p_branch_id: string
          p_cash_received: number
          p_cashier_id: string
          p_change_given: number
          p_discount_amount: number
          p_subtotal: number
          p_tax_amount: number
          p_total: number
        }
        Returns: {
          receipt_number: string
          sale_id: string
        }[]
      }
      current_store_id: { Args: never; Returns: string }
      generate_receipt_number: {
        Args: { branch_code: string }
        Returns: string
      }
      generate_return_number: { Args: { branch_code: string }; Returns: string }
      get_effective_price: {
        Args: { _product_id: string; _quantity: number }
        Returns: number
      }
      get_user_branch: { Args: { _user_id: string }; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_owner: { Args: { _uid: string }; Returns: boolean }
      switch_store: { Args: { _store_id: string }; Returns: undefined }
      transfer_stock: {
        Args: {
          p_from: string
          p_notes: string
          p_product: string
          p_qty: number
          p_to: string
        }
        Returns: string
      }
      user_store: { Args: { _uid: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "branch_supervisor" | "stock_manager" | "cashier"
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "login"
        | "logout"
        | "void"
        | "refund"
        | "price_override"
        | "discount_apply"
      stock_operation_type:
        | "receive"
        | "sale"
        | "return"
        | "adjustment"
        | "transfer_in"
        | "transfer_out"
      transaction_status:
        | "pending"
        | "completed"
        | "voided"
        | "suspended"
        | "refunded"
      unit_of_measure:
        | "pcs"
        | "kg"
        | "g"
        | "l"
        | "ml"
        | "box"
        | "pack"
        | "dozen"
        | "carton"
        | "crate"
        | "case"
        | "bag"
        | "sack"
        | "bottle"
        | "can"
        | "tin"
        | "jar"
        | "sachet"
        | "roll"
        | "bundle"
        | "pair"
        | "set"
        | "tray"
        | "packet"
        | "piece"
        | "gallon"
        | "m"
        | "cm"
        | "yard"
        | "ream"
        | "tube"
        | "pallet"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "branch_supervisor", "stock_manager", "cashier"],
      audit_action: [
        "create",
        "update",
        "delete",
        "login",
        "logout",
        "void",
        "refund",
        "price_override",
        "discount_apply",
      ],
      stock_operation_type: [
        "receive",
        "sale",
        "return",
        "adjustment",
        "transfer_in",
        "transfer_out",
      ],
      transaction_status: [
        "pending",
        "completed",
        "voided",
        "suspended",
        "refunded",
      ],
      unit_of_measure: [
        "pcs",
        "kg",
        "g",
        "l",
        "ml",
        "box",
        "pack",
        "dozen",
        "carton",
        "crate",
        "case",
        "bag",
        "sack",
        "bottle",
        "can",
        "tin",
        "jar",
        "sachet",
        "roll",
        "bundle",
        "pair",
        "set",
        "tray",
        "packet",
        "piece",
        "gallon",
        "m",
        "cm",
        "yard",
        "ream",
        "tube",
        "pallet",
      ],
    },
  },
} as const
