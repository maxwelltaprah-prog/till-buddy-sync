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
        ]
      }
      branch_inventory: {
        Row: {
          branch_id: string
          created_at: string | null
          id: string
          last_restocked_at: string | null
          product_id: string
          quantity: number | null
          reserved_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          id?: string
          last_restocked_at?: string | null
          product_id: string
          quantity?: number | null
          reserved_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          id?: string
          last_restocked_at?: string | null
          product_id?: string
          quantity?: number | null
          reserved_quantity?: number | null
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
          name: string
          operating_hours: Json | null
          phone: string | null
          settings: Json | null
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
          name: string
          operating_hours?: Json | null
          phone?: string | null
          settings?: Json | null
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
          name?: string
          operating_hours?: Json | null
          phone?: string | null
          settings?: Json | null
          tax_rate?: number | null
          updated_at?: string | null
        }
        Relationships: []
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
          sku: string
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
          sku: string
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
          sku?: string
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
        ]
      }
      sale_items: {
        Row: {
          created_at: string | null
          discount_amount: number | null
          id: string
          is_bulk_price: boolean | null
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          tax_amount: number | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          is_bulk_price?: boolean | null
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          tax_amount?: number | null
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          is_bulk_price?: boolean | null
          product_id?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          tax_amount?: number | null
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
          receipt_number: string
          status: Database["public"]["Enums"]["transaction_status"] | null
          subtotal: number
          tax_amount: number | null
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
          receipt_number: string
          status?: Database["public"]["Enums"]["transaction_status"] | null
          subtotal?: number
          tax_amount?: number | null
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
          receipt_number?: string
          status?: Database["public"]["Enums"]["transaction_status"] | null
          subtotal?: number
          tax_amount?: number | null
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
        ]
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
          updated_at?: string | null
        }
        Relationships: []
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
        }
        Insert: {
          branch_id: string
          cart_data: Json
          cashier_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
        }
        Update: {
          branch_id?: string
          cart_data?: Json
          cashier_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suspended_sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
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
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
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
      unit_of_measure: ["pcs", "kg", "g", "l", "ml", "box", "pack", "dozen"],
    },
  },
} as const
