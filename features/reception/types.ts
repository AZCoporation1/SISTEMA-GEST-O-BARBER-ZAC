/**
 * Barber Zac — Reception Feature Types
 */

// ── Enums ─────────────────────────────────────────────────

export type ReceptionAdvanceTypeEnum =
  | 'cash_advance'
  | 'pix_advance'
  | 'stock_withdrawal'
  | 'manual_deduction'

export type ReceptionAdvanceSourceMethodEnum =
  | 'caixa'
  | 'pix'
  | 'estoque'
  | 'manual'

export type ReceptionAdvanceStatusEnum = 'active' | 'cancelled' | 'applied'
export type ReceptionClosureStatusEnum = 'draft' | 'confirmed' | 'paid' | 'cancelled'

// ── Row Types ──────────────────────────────────────────────

export interface ReceptionStaffRow {
  id: string
  user_profile_id: string | null
  full_name: string
  display_name: string
  is_active: boolean
  base_salary_per_period: number | null
  settlement_primary_day: number | null
  settlement_secondary_day: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ReceptionAdvanceRow {
  id: string
  staff_id: string
  occurred_at: string
  type: ReceptionAdvanceTypeEnum
  source_method: ReceptionAdvanceSourceMethodEnum
  description: string
  quantity: number
  unit_amount: number
  total_amount: number
  product_id: string | null
  cash_entry_id: string | null
  financial_movement_id: string | null
  stock_movement_id: string | null
  closure_id: string | null
  period_start: string
  period_end: string
  status: ReceptionAdvanceStatusEnum
  created_by: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ReceptionClosureRow {
  id: string
  staff_id: string
  period_start: string
  period_end: string
  salary_amount: number
  advances_total: number
  adjustments_total: number
  net_payable: number
  legit_text: string | null
  status: ReceptionClosureStatusEnum
  paid_method: string | null
  paid_at: string | null
  cash_entry_id: string | null
  financial_movement_id: string | null
  snapshot_json: any | null
  created_by: string | null
  confirmed_by: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ── Compound Types ─────────────────────────────────────────

export type ReceptionStaff = ReceptionStaffRow
export type ReceptionAdvance = ReceptionAdvanceRow
export type ReceptionClosure = ReceptionClosureRow & {
  staff?: { display_name: string; full_name: string } | null
}

// ── Ledger ─────────────────────────────────────────────────

export interface ReceptionLedgerSummary {
  salaryAmount: number
  hasSalaryDefined: boolean
  advancesTotal: number
  stockWithdrawalsTotal: number
  adjustmentsTotal: number
  netPayable: number
  advancesCount: number
}

export interface ReceptionLedger {
  summary: ReceptionLedgerSummary
  advances: ReceptionAdvance[]
  stockWithdrawals: ReceptionAdvance[]
  closures: ReceptionClosure[]
  auditEvents: any[]
  draftClosure: ReceptionClosure | null
}

// ── Period ─────────────────────────────────────────────────

export interface ReceptionPeriod {
  start: Date
  end: Date
  paymentDate: Date
  label: string
}

// ── Inputs ─────────────────────────────────────────────────

export interface RegisterReceptionAdvanceInput {
  staff_id: string
  type: ReceptionAdvanceTypeEnum
  source_method: ReceptionAdvanceSourceMethodEnum
  description: string
  quantity: number
  unit_amount: number
  total_amount: number
  product_id?: string | null
  period_start: string
  period_end: string
  notes?: string | null
}

export interface ConfirmReceptionClosureInput {
  staff_id: string
  closure_id: string   // draft closure id
  period_start: string
  period_end: string
  salary_amount: number
  advances_total: number
  adjustments_total: number
  net_payable: number
  legit_text: string
  snapshot_json: any
  advance_ids: string[]
  notes?: string | null
}

// ── Labels & Colors ────────────────────────────────────────

export const RECEPTION_ADVANCE_TYPE_LABELS: Record<ReceptionAdvanceTypeEnum, string> = {
  cash_advance: 'Adiantamento em Dinheiro',
  pix_advance: 'Adiantamento via PIX',
  stock_withdrawal: 'Retirada de Estoque',
  manual_deduction: 'Dedução Manual',
}

export const RECEPTION_SOURCE_METHOD_LABELS: Record<ReceptionAdvanceSourceMethodEnum, string> = {
  caixa: 'Caixa',
  pix: 'PIX',
  estoque: 'Estoque',
  manual: 'Manual',
}

export const RECEPTION_CLOSURE_STATUS_LABELS: Record<ReceptionClosureStatusEnum, string> = {
  draft: 'Aberto',
  confirmed: 'Confirmado',
  paid: 'Pago',
  cancelled: 'Cancelado',
}

export const RECEPTION_CLOSURE_STATUS_COLORS: Record<ReceptionClosureStatusEnum, string> = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400',
}

export const RECEPTION_ADVANCE_STATUS_LABELS: Record<ReceptionAdvanceStatusEnum, string> = {
  active: 'Ativo',
  cancelled: 'Cancelado',
  applied: 'Aplicado',
}

export const RECEPTION_ADVANCE_STATUS_COLORS: Record<ReceptionAdvanceStatusEnum, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400',
  applied: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400',
}
