/**
 * Barber Zac — Perfume Sales Feature Types
 */

import type {
  PerfumeSaleRow,
  PerfumeSaleInstallmentRow,
  PerfumeSaleStatusEnum,
  PerfumePaymentModeEnum,
  PerfumeInstallmentStatusEnum,
} from '@/types/supabase'

// ── Domain Aliases ──────────────────────────────────────

export type PerfumeSale = PerfumeSaleRow & {
  professional?: { name: string; display_name: string | null } | null
  customer?: { full_name: string; mobile_phone: string | null } | null
  product?: { name: string; external_code: string | null } | null
  installments?: PerfumeSaleInstallment[]
}

export type PerfumeSaleInstallment = PerfumeSaleInstallmentRow

// ── Registration Input ──────────────────────────────────

export interface RegisterPerfumeSaleInput {
  professional_id: string
  // Customer
  customer_id?: string | null
  customer_name: string
  customer_phone: string
  // Product
  inventory_product_id: string
  // Sale
  payment_mode: PerfumePaymentModeEnum
  installment_count?: number | null
  due_day?: number | null
  unit_price: number
  quantity: number
  commission_percent: number
  payment_method?: string | null
  notes?: string | null
}

// ── Pay Installment Input ───────────────────────────────

export interface PayInstallmentInput {
  installment_id: string
  payment_method: string
}

// ── Cancel Input ────────────────────────────────────────

export interface CancelPerfumeSaleInput {
  sale_id: string
  reason: string
}

export interface ReverseInstallmentPaymentInput {
  installment_id: string
  reason: string
}

// ── Filters ─────────────────────────────────────────────

export interface PerfumeSalesFilters {
  page: number
  perPage: number
  search?: string
  status?: string
  professionalId?: string
  startDate?: string
  endDate?: string
}

export interface PerfumeClientsFilters {
  page: number
  perPage: number
  search?: string
  debtorsOnly?: boolean
}

// ── Debtor Summary ──────────────────────────────────────

export interface PerfumeClientSummary {
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  total_purchases: number
  total_amount: number
  total_paid: number
  total_pending: number
  overdue_count: number
  sales: PerfumeSale[]
}

// ── Status Labels (PT-BR) ───────────────────────────────

export const PERFUME_SALE_STATUS_LABELS: Record<PerfumeSaleStatusEnum, string> = {
  active: 'Ativa',
  cancelled: 'Cancelada',
  completed: 'Concluída',
  receivable_open: 'A Receber',
  receivable_settled: 'Quitada',
}

export const PERFUME_SALE_STATUS_COLORS: Record<PerfumeSaleStatusEnum, string> = {
  active: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400',
  receivable_open: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400',
  receivable_settled: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400',
}

export const PERFUME_INSTALLMENT_STATUS_LABELS: Record<PerfumeInstallmentStatusEnum, string> = {
  open: 'Aberta',
  paid: 'Paga',
  overdue: 'Vencida',
  cancelled: 'Cancelada',
}

export const PERFUME_INSTALLMENT_STATUS_COLORS: Record<PerfumeInstallmentStatusEnum, string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-400',
}

export const PAYMENT_MODE_LABELS: Record<PerfumePaymentModeEnum, string> = {
  cash: 'À Vista',
  installments: 'A Prazo',
}
