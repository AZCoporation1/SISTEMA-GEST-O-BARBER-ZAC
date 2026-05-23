import { Database } from "@/types/supabase"

// ── Row types (manually defined since new tables) ──

export interface AccountsReceivableRow {
  id: string
  sale_id: string | null
  customer_id: string | null
  customer_name_snapshot: string | null
  customer_phone_snapshot: string | null
  professional_id: string | null
  source_type: 'sale' | 'manual' | 'reception' | 'subscription'
  payment_origin: 'credit_card_installment' | 'store_credit' | 'mixed_payment'
  installment_number: number
  total_installments: number
  amount: number
  amount_paid: number
  due_date: string
  status: 'open' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'reversed'
  description: string
  notes: string | null
  cash_entry_id: string | null
  financial_movement_id: string | null
  created_by: string | null
  paid_by: string | null
  paid_at: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
}

export interface AccountsReceivablePaymentRow {
  id: string
  receivable_id: string
  amount: number
  payment_method: 'dinheiro' | 'pix' | 'debit_card' | 'credit_card'
  paid_at: string
  cash_entry_id: string | null
  financial_movement_id: string | null
  created_by: string | null
  notes: string | null
  status: 'active' | 'reversed'
  reversed_at: string | null
  reversed_by: string | null
  reversal_reason: string | null
  created_at: string
}

// ── Extended types with relations ──

export interface ReceivableWithRelations extends AccountsReceivableRow {
  customer?: { full_name: string; phone?: string; mobile_phone?: string } | null
  professional?: { name: string } | null
  payments?: AccountsReceivablePaymentRow[]
}

// ── Summary KPIs ──

export interface ReceivableSummary {
  totalOpen: number
  totalOverdue: number
  dueTodayCount: number
  dueTodayAmount: number
  receivedThisMonth: number
  totalReceivables: number
}

// ── Filters ──

export interface ReceivableFilters {
  page: number
  perPage: number
  status?: string
  customerId?: string
  professionalId?: string
  startDate?: string
  endDate?: string
  search?: string
}

// ── Installment schedule item ──

export interface InstallmentItem {
  installment_number: number
  total_installments: number
  amount: number
  due_date: string
}
