/**
 * Barber Zac — Professionals + Commissions Feature Types
 */

import type {
  CollaboratorRow,
  ProfessionalAdvanceRow,
  ProfessionalClosureRow,
  AdvanceTypeEnum,
  AdvanceSourceMethodEnum,
} from '@/types/supabase'
import type { FortnightPeriod } from '@/features/commissions/services/periodUtils'

// ── Domain Aliases ──────────────────────────────────────

export type Professional = CollaboratorRow
export type ProfessionalAdvance = ProfessionalAdvanceRow
export type ProfessionalClosure = ProfessionalClosureRow & {
  professional?: { name: string; display_name: string | null } | null
}

// ── Advance Registration ────────────────────────────────

export interface RegisterAdvanceInput {
  professional_id: string
  type: AdvanceTypeEnum
  source_method: AdvanceSourceMethodEnum
  description: string
  quantity: number
  unit_amount: number
  total_amount: number
  product_id?: string | null
  carry_over_to_next_period: boolean
  notes?: string | null
}

// ── Closure Preview ─────────────────────────────────────

export interface ClosurePreview {
  professional: Professional
  period: FortnightPeriod
  grossTotal: number
  salesCount: number
  servicesCount: number
  productsCount: number
  itemsQuantity: number
  ticketMedio: number
  commissionPercent: number
  barberShare: number
  barbershopShare: number
  advances: ProfessionalAdvance[]
  advancesTotal: number
  deferredItems: ProfessionalAdvance[]
  deferredTotal: number
  netPayable: number
  legitText: string
}

export interface ConfirmClosureInput {
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
  legit_text: string
  snapshot_json: any
  advance_ids: string[]
  notes?: string | null
}

// ── Professional Metrics ────────────────────────────────

export interface ProfessionalPeriodMetrics {
  grossTotal: number
  salesCount: number
  servicesCount: number
  productsCount: number
  itemsQuantity: number
  ticketMedio: number
  barberShare: number
  barbershopShare: number
  advancesTotal: number
  netPayable: number
}

// ── Advance Type Labels (PT-BR) ─────────────────────────

export const ADVANCE_TYPE_LABELS: Record<AdvanceTypeEnum, string> = {
  cash_advance: 'Adiantamento em Dinheiro',
  pix_advance: 'Adiantamento via PIX',
  stock_consumption: 'Consumo de Estoque',
  manual_deduction: 'Dedução Manual',
  deferred_deduction: 'Dedução Diferida',
}

export const SOURCE_METHOD_LABELS: Record<AdvanceSourceMethodEnum, string> = {
  caixa: 'Caixa',
  pix: 'PIX',
  estoque: 'Estoque',
  manual: 'Manual',
}

export const CLOSURE_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  confirmed: 'Confirmado',
  paid: 'Pago',
  cancelled: 'Cancelado',
}

export const CLOSURE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400',
}

export const ADVANCE_STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  cancelled: 'Cancelado',
  applied: 'Aplicado',
}

export const ADVANCE_STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400',
  applied: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400',
}
