// Barber Zac ERP — Supabase Database Types
// Based on migration: 20260314_000002_professional_schema_overhaul.sql
// Extended: 20260423_000010_auth_roles_professional_requests.sql

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ── Enums ──────────────────────────────────────────────────
export type MovementTypeEnum =
  | 'initial_balance'
  | 'purchase_entry'
  | 'sale_exit'
  | 'internal_consumption'
  | 'loss'
  | 'damage'
  | 'manual_adjustment_in'
  | 'manual_adjustment_out'
  | 'transfer'
  | 'return_from_customer'
  | 'supplier_return'

export type CashEntryTypeEnum =
  | 'income'
  | 'expense'
  | 'withdrawal'
  | 'reinforcement'
  | 'sale_income'
  | 'manual_income'
  | 'manual_expense'

export type SystemRoleEnum = 'admin_total' | 'professional' | 'owner_admin_professional'

export type ProfessionalRequestTypeEnum =
  | 'inventory_sale'
  | 'service_sale'
  | 'perfume_sale'
  | 'stock_withdrawal'
  | 'manual_deduction'

export type ProfessionalRequestStatusEnum = 'pending' | 'approved' | 'rejected' | 'cancelled'

// ── Table Row Types ────────────────────────────────────────
export interface AppSettingsRow {
  id: string
  organization_name: string
  currency: string
  timezone: string
  default_markup: number
  low_stock_alert_enabled: boolean
  critical_stock_alert_enabled: boolean
  ai_enabled: boolean
  created_at: string
  updated_at: string
}

export interface UserProfileRow {
  id: string
  auth_user_id: string | null
  full_name: string
  email: string
  role: 'admin' | 'gestor' | 'operador'
  system_role: SystemRoleEnum
  display_name: string | null
  collaborator_id: string | null
  is_active: boolean
  can_approve_professional_requests: boolean
  can_view_all_professionals: boolean
  can_manage_system: boolean
  can_submit_professional_requests: boolean
  created_at: string
  updated_at: string
}

export interface AuditLogRow {
  id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  before_data: Json | null
  after_data: Json | null
  context: Json | null
  created_at: string
  
  // Joined via foreign key in useAuditLogs
  actor?: {
    full_name: string
  }
}

export interface InventoryCategoryRow {
  id: string
  code_prefix: string | null
  name: string
  normalized_name: string
  aliases: Json | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ProductBrandRow {
  id: string
  name: string
  normalized_name: string
  aliases: Json | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InventoryProductRow {
  id: string
  external_code: string | null
  category_id: string | null
  brand_id: string | null
  name: string
  normalized_name: string
  sku: string | null
  barcode: string | null
  unit_type: string
  cost_price: number
  markup_percent: number
  markup_value_generated: number
  sale_price_generated: number
  sale_price_cash: number | null
  sale_price_installment: number | null
  min_stock: number
  max_stock: number
  reorder_point: number | null
  is_for_resale: boolean
  is_for_internal_use: boolean
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface StockMovementRow {
  id: string
  product_id: string
  movement_type: MovementTypeEnum
  movement_reason: string
  source_type: string
  destination_type: string
  location_id: string | null
  quantity: number
  unit_cost_snapshot: number | null
  unit_sale_snapshot: number | null
  total_cost_snapshot: number | null
  total_sale_snapshot: number | null
  reference_type: string | null
  reference_id: string | null
  notes: string | null
  performed_by: string | null
  approved_by: string | null
  movement_date: string
  created_at: string
}

export interface ServiceCategoryRow {
  id: string
  name: string
  normalized_name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ServiceRow {
  id: string
  name: string
  normalized_name: string
  description: string | null
  duration_minutes: number
  price: number
  commission_percent: number
  category_id: string | null
  price_type: string
  return_days: number | null
  is_bookable: boolean
  show_price: boolean
  simultaneous_slots: number
  notes: string | null
  image_url: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SaleRow {
  id: string
  customer_id: string | null
  collaborator_id: string | null
  sale_date: string
  status: 'pending' | 'completed' | 'cancelled' | 'refunded'
  payment_method_id: string | null
  subtotal: number
  discount_amount: number
  total: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  customer_name_snapshot?: string | null
  customer_phone_snapshot?: string | null
}

export interface SaleItemRow {
  id: string
  sale_id: string
  item_type: 'product' | 'service' | 'combo'
  product_id: string | null
  service_id?: string | null
  service_name: string | null
  quantity: number
  unit_cost_snapshot: number
  unit_price_snapshot: number
  discount_amount: number
  total: number
  created_at: string
}

export interface CashSessionRow {
  id: string
  session_date: string
  opening_amount: number
  closing_amount: number | null
  expected_amount: number | null
  difference_amount: number | null
  status: 'open' | 'closed' | 'audited'
  opened_by: string | null
  closed_by: string | null
  opened_at: string
  closed_at: string | null
  notes: string | null
}

export interface CashEntryRow {
  id: string
  cash_session_id: string
  entry_type: string
  category: string
  description: string
  amount: number
  payment_method_id: string | null
  reference_type: string | null
  reference_id: string | null
  occurred_at: string
  created_by: string | null
  created_at: string
  status: string | null
  reversed_by_entry_id: string | null
  reversal_of_entry_id: string | null
  cancellation_reason: string | null
  cancelled_by: string | null
  cancelled_at: string | null
}

export interface FixedCostRow {
  id: string
  name: string
  category: string
  amount: number
  due_day: number | null
  frequency: 'monthly' | 'weekly' | 'yearly'
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface VariableCostRow {
  id: string
  name: string
  category: string
  amount: number
  occurred_on: string
  notes: string | null
  reference_type: string | null
  reference_id: string | null
  created_at: string
  updated_at: string
}

export interface FinancialMovementRow {
  id: string
  movement_type: 'payable' | 'receivable' | 'paid' | 'received'
  category: string
  subcategory: string | null
  description: string
  amount: number
  occurred_on: string
  origin_type: string
  origin_id: string | null
  created_at: string
}

export interface CommissionRuleRow {
  id: string
  profile_id: string
  rule_type: 'percent' | 'fixed'
  applies_to: 'global' | 'category' | 'product' | 'service'
  collaborator_id: string | null
  product_id: string | null
  category_id: string | null
  percent: number | null
  fixed_amount: number | null
  priority: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CommissionEntryRow {
  id: string
  collaborator_id: string
  sale_id: string
  sale_item_id: string | null
  commission_rule_id: string | null
  base_amount: number
  commission_amount: number
  competence_date: string
  status: 'pending' | 'paid' | 'cancelled'
  created_at: string
}

export interface CollaboratorRow {
  id: string
  name: string
  role: 'barbeiro' | 'assistente' | 'gerente' | 'outro'
  is_active: boolean
  display_name: string | null
  default_commission_percent: number
  settlement_primary_day: number
  settlement_secondary_day: number
  created_at: string
  updated_at: string
}

export interface CustomerRow {
  id: string
  full_name: string
  normalized_name?: string | null
  mobile_phone?: string | null
  phone: string | null
  email: string | null
  ddi?: string | null
  cpf?: string | null
  rg?: string | null
  birth_date?: string | null
  gender?: string | null
  address_line?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  address_number?: string | null
  complement?: string | null
  notes: string | null
  referral_source?: string | null
  legacy_login?: string | null
  loyalty_points?: number | null
  legacy_created_at?: string | null
  legacy_last_visit_at?: string | null
  days_since_last_visit?: number | null
  avatar_url?: string | null
  is_active?: boolean | null
  created_at: string
  updated_at: string
}

export interface PaymentMethodRow {
  id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}


export interface AiCommandRow {
  id: string
  command_text: string
  intent: string
  parsed_payload: Json
  status: 'pending' | 'approved' | 'executed' | 'failed' | 'rejected'
  requested_by: string | null
  executed_by: string | null
  created_at: string
  executed_at: string | null
}

export type AdvanceTypeEnum =
  | 'cash_advance'
  | 'pix_advance'
  | 'stock_consumption'
  | 'manual_deduction'
  | 'deferred_deduction'

export type AdvanceSourceMethodEnum =
  | 'caixa'
  | 'pix'
  | 'estoque'
  | 'manual'

export type AdvanceStatusEnum = 'active' | 'cancelled' | 'applied'
export type ClosureStatusEnum = 'draft' | 'confirmed' | 'paid' | 'cancelled'

export interface ProfessionalAdvanceRow {
  id: string
  professional_id: string
  occurred_at: string
  type: AdvanceTypeEnum
  source_method: AdvanceSourceMethodEnum
  description: string
  quantity: number
  unit_amount: number
  total_amount: number
  product_id: string | null
  cash_entry_id: string | null
  financial_movement_id: string | null
  stock_movement_id: string | null
  closure_id: string | null
  carry_over_to_next_period: boolean
  status: AdvanceStatusEnum
  created_by: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProfessionalClosureRow {
  id: string
  professional_id: string
  period_start: string
  period_end: string
  payment_reference_date: string
  gross_total: number
  commission_percent_snapshot: number
  barber_share: number
  barbershop_share: number
  advances_total: number
  deferred_total: number
  net_payable: number
  legit_text: string | null
  status: ClosureStatusEnum
  paid_method: string | null
  paid_at: string | null
  cash_entry_id: string | null
  financial_movement_id: string | null
  snapshot_json: Json | null
  created_by: string | null
  confirmed_by: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ── Professional Requests (Approval Queue) ─────────────────
export interface ProfessionalRequestRow {
  id: string
  professional_id: string
  submitted_by: string
  request_type: ProfessionalRequestTypeEnum
  status: ProfessionalRequestStatusEnum
  title: string
  payload_json: Json
  customer_id: string | null
  customer_name_snapshot: string | null
  customer_phone_snapshot: string | null
  inventory_product_id: string | null
  service_id: string | null
  linked_sale_id: string | null
  linked_perfume_sale_id: string | null
  linked_advance_id: string | null
  linked_cash_entry_id: string | null
  linked_financial_movement_id: string | null
  linked_stock_movement_id: string | null
  admin_notes: string | null
  rejection_reason: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  created_at: string
  updated_at: string
}

// ── View Row Types ─────────────────────────────────────────
export interface VwInventoryPositionRow {
  product_id: string
  external_code: string | null
  product_name: string
  category_name: string | null
  brand_name: string | null
  cost_price: number
  markup_percent: number
  sale_price: number
  sale_price_cash: number | null
  sale_price_installment: number | null
  current_balance: number
  min_stock: number
  max_stock: number
  suggested_purchase: number
  stock_status: 'sem_estoque' | 'abaixo_do_minimo' | 'acima_do_maximo' | 'normal'
  total_cost_value: number
  total_sale_value: number
  is_for_resale?: boolean
  is_for_internal_use?: boolean
  is_active?: boolean
}

export interface VwDailyCashSummaryRow {
  session_id: string
  session_date: string
  opening_amount: number
  total_inflows: number
  total_outflows: number
  closing_amount: number | null
  calculated_expected: number
  difference_amount: number | null
  status: string
}

export interface VwCommissionSummaryRow {
  collaborator_id: string
  month: string
  total_base_commissionable: number
  total_commission: number
  paid_commission: number
}

export interface VwFinancialFlowSummaryRow {
  flow_date: string
  total_revenue: number
  total_expenses: number
  fixed_costs: number
  net_profit: number
}

// ── Generic Database interface for Supabase client ─────────
type GenericTable = {
  Row: Record<string, any>
  Insert: Record<string, any>
  Update: Record<string, any>
  Relationships: any[]
}
type GenericView = {
  Row: Record<string, any>
  Relationships: any[]
}

export interface Database {
  public: {
    Tables: {
      app_settings: GenericTable
      user_profiles: GenericTable
      inventory_categories: GenericTable
      product_brands: GenericTable
      inventory_products: GenericTable
      inventory_locations: GenericTable
      suppliers: GenericTable
      purchase_orders: GenericTable
      purchase_order_items: GenericTable
      stock_movements: GenericTable
      stock_adjustments: GenericTable
      customers: GenericTable
      collaborators: GenericTable
      payment_methods: GenericTable
      sales: GenericTable
      sale_items: GenericTable
      cash_sessions: GenericTable
      cash_entries: GenericTable
      fixed_costs: GenericTable
      variable_costs: GenericTable
      financial_movements: GenericTable
      commission_profiles: GenericTable
      commission_rules: GenericTable
      commission_entries: GenericTable
      commission_periods: GenericTable
      ai_commands: GenericTable
      ai_action_logs: GenericTable
      import_jobs: GenericTable
      import_rows: GenericTable
      export_jobs: GenericTable
      audit_logs: GenericTable
      professional_advances: GenericTable
      professional_closures: GenericTable
      perfume_sales: GenericTable
      perfume_sale_installments: GenericTable
      services: GenericTable
      service_categories: GenericTable
      professional_requests: GenericTable
      [key: string]: GenericTable
    }
    Views: {
      vw_inventory_position: GenericView
      vw_stock_movement_summary: GenericView
      vw_daily_cash_summary: GenericView
      vw_financial_flow_summary: GenericView
      vw_commission_summary: GenericView
      [key: string]: GenericView
    }
    Functions: Record<string, unknown>
    Enums: {
      movement_type_enum: MovementTypeEnum
      cash_entry_type: CashEntryTypeEnum
    }
    CompositeTypes: Record<string, unknown>
  }
}

export const Constants = {
  public: {
    Enums: {
      movement_type_enum: [
        'initial_balance', 'purchase_entry', 'sale_exit',
        'internal_consumption', 'loss', 'damage',
        'manual_adjustment_in', 'manual_adjustment_out',
        'transfer', 'return_from_customer', 'supplier_return'
      ] as const,
      cash_entry_type: [
        'income', 'expense', 'withdrawal', 'reinforcement',
        'sale_income', 'manual_income', 'manual_expense'
      ] as const,
    }
  }
}

// Convenience alias
export type ProductWithStatus = VwInventoryPositionRow

// ── Perfume Sales Types ────────────────────────────────────
export type PerfumeSaleStatusEnum = 'active' | 'cancelled' | 'completed' | 'receivable_open' | 'receivable_settled'
export type PerfumePaymentModeEnum = 'cash' | 'installments'
export type PerfumeInstallmentStatusEnum = 'open' | 'paid' | 'overdue' | 'cancelled'

export interface PerfumeSaleRow {
  id: string
  professional_id: string
  customer_id: string | null
  customer_name_snapshot: string
  customer_phone_snapshot: string | null
  inventory_product_id: string
  external_code_snapshot: string | null
  perfume_name_snapshot: string
  sale_date: string
  payment_mode: PerfumePaymentModeEnum
  installment_count: number | null
  due_day: number | null
  unit_price_snapshot: number
  quantity: number
  total_price: number
  commission_percent_snapshot: number
  commission_amount_snapshot: number
  payment_method_initial: string | null
  status: PerfumeSaleStatusEnum
  linked_cash_entry_id: string | null
  linked_financial_movement_id: string | null
  stock_movement_id: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  created_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PerfumeSaleInstallmentRow {
  id: string
  perfume_sale_id: string
  installment_number: number
  due_date: string
  amount: number
  status: PerfumeInstallmentStatusEnum
  paid_at: string | null
  paid_method: string | null
  cash_entry_id: string | null
  financial_movement_id: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
