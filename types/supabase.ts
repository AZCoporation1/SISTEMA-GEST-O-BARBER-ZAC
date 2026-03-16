// Stub generated to bypass TS parser/turbopack limits and recover from 0-byte truncation

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type GenericTable = { Row: { id: any; [key: string]: any }; Insert: { [key: string]: any }; Update: { [key: string]: any }; Relationships: any[] }
type GenericView = { Row: { id: any; [key: string]: any }; Relationships: any[] }

export interface Database {
  public: {
    Tables: {
      cash_sessions: GenericTable
      cash_entries: GenericTable
      inventory_products: GenericTable
      inventory_categories: GenericTable
      product_brands: GenericTable
      movements: GenericTable
      fixed_costs: GenericTable
      variable_costs: GenericTable
      commission_rules: GenericTable
      commission_entries: GenericTable
      app_settings: GenericTable
      [key: string]: GenericTable
    }
    Views: {
      vw_inventory_position: GenericView
      vw_commission_summary: GenericView
      vw_daily_cash_summary: GenericView
      [key: string]: GenericView
    }
    Functions: any
    Enums: any
    CompositeTypes: any
  }
}

export const Constants = {
  public: {
    Enums: {
      movement_type_enum: ["entrada", "saida", "ajuste", "perda", "retorno"] as const,
      cash_entry_type: ["in", "out"] as const
    }
  }
}

export type ProductWithStatus = any
