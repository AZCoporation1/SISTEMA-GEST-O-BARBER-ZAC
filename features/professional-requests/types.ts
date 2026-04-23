import type { ProfessionalRequestTypeEnum, ProfessionalRequestStatusEnum, Json } from '@/types/supabase'

// ── Request Type Labels ────────────────────────────────────
export const REQUEST_TYPE_LABELS: Record<ProfessionalRequestTypeEnum, string> = {
  inventory_sale: 'Venda de Produto',
  service_sale: 'Serviço Realizado',
  perfume_sale: 'Venda de Perfume',
  stock_withdrawal: 'Retirada de Estoque',
  manual_deduction: 'Dedução Manual',
}

export const REQUEST_STATUS_LABELS: Record<ProfessionalRequestStatusEnum, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  cancelled: 'Cancelada',
}

// ── Input Types ────────────────────────────────────────────

export interface SubmitInventorySaleInput {
  professional_id: string
  items: Array<{
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    unit_cost: number
    discount: number
  }>
  customer_id?: string
  customer_name?: string
  customer_phone?: string
  payment_method_id: string
  discount_amount: number
  notes?: string
}

export interface SubmitServiceSaleInput {
  professional_id: string
  items: Array<{
    service_id?: string
    service_name: string
    quantity: number
    unit_price: number
    discount: number
  }>
  customer_id?: string
  customer_name?: string
  customer_phone?: string
  payment_method_id: string
  discount_amount: number
  notes?: string
}

export interface SubmitPerfumeSaleInput {
  professional_id: string
  inventory_product_id: string
  product_name: string
  quantity: number
  unit_price: number
  commission_percent: number
  payment_mode: 'cash' | 'installments'
  payment_method?: string
  installment_count?: number
  due_day?: number
  customer_id?: string
  customer_name: string
  customer_phone?: string
  notes?: string
}

export interface SubmitStockWithdrawalInput {
  professional_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_amount: number
  description: string
  notes?: string
}

export interface SubmitManualDeductionInput {
  professional_id: string
  description: string
  quantity: number
  unit_amount: number
  carry_over_to_next_period: boolean
  notes?: string
}

// ── Approval Types ─────────────────────────────────────────

export interface ApproveRequestInput {
  request_id: string
  admin_notes?: string
}

export interface RejectRequestInput {
  request_id: string
  rejection_reason: string
}

// ── Impact Preview Types ───────────────────────────────────

export interface ApprovalImpact {
  stock: Array<{ product_name: string; quantity_change: number; current_balance?: number }>
  cash: { amount: number; entry_type: string; category: string } | null
  financial: { amount: number; movement_type: string; category: string } | null
  commission: { amount: number; percent: number; professional_name: string } | null
  receivable: { total: number; installments: number; due_day?: number } | null
}

// ── Extended Row for UI (with joins) ───────────────────────

export interface ProfessionalRequestWithDetails {
  id: string
  professional_id: string
  submitted_by: string
  request_type: ProfessionalRequestTypeEnum
  status: ProfessionalRequestStatusEnum
  title: string
  payload_json: Json
  customer_name_snapshot: string | null
  customer_phone_snapshot: string | null
  inventory_product_id: string | null
  admin_notes: string | null
  rejection_reason: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  created_at: string
  updated_at: string
  // Joined
  professional?: { id: string; name: string; display_name: string | null }
  submitter?: { id: string; full_name: string; display_name: string | null }
  approver?: { id: string; full_name: string; display_name: string | null }
  rejector?: { id: string; full_name: string; display_name: string | null }
}
