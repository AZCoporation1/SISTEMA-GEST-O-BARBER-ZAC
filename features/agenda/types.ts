/**
 * Barber Zac ERP — Agenda Module Types
 */

// ── Status & Source Enums ────────────────────────────────

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'blocked'
  | 'encaixe'

export type AppointmentSource = 'admin' | 'professional' | 'customer' | 'imported'

export type BlockType = 'manual' | 'lunch' | 'meeting' | 'unavailable' | 'recurring'

export type WaitlistStatus = 'waiting' | 'contacted' | 'scheduled' | 'cancelled'

export type WaitlistPeriod = 'morning' | 'afternoon' | 'evening' | 'any'

export type CommandItemType = 'service' | 'product' | 'manual'

// ── Row Types ────────────────────────────────────────────

export interface AgendaSettingsRow {
  id: string
  opening_time: string
  closing_time: string
  slot_interval_minutes: number
  allow_overbooking: boolean
  default_view: string
  timezone: string
  created_at: string
  updated_at: string
}

export interface ProfessionalWorkingHoursRow {
  id: string
  professional_id: string
  weekday: number
  start_time: string
  end_time: string
  break_start_time: string | null
  break_end_time: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AppointmentRow {
  id: string
  customer_id: string | null
  customer_name_snapshot: string | null
  customer_phone_snapshot: string | null
  professional_id: string
  service_id: string | null
  service_name_snapshot: string | null
  service_price_snapshot: number | null
  service_duration_minutes_snapshot: number | null
  start_at: string
  end_at: string
  status: AppointmentStatus
  source: AppointmentSource
  notes: string | null
  linked_sale_id: string | null
  recurrence_rule: any | null
  /** Subscription link — set when appointment belongs to a subscription */
  subscription_id: string | null
  /** Specific occurrence within the subscription cycle */
  subscription_occurrence_id: string | null
  /** Quick flag — true for subscription-generated appointments */
  is_subscription: boolean
  created_by: string | null
  updated_by: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  created_at: string
  updated_at: string
}

export interface AppointmentBlockRow {
  id: string
  professional_id: string
  start_at: string
  end_at: string
  block_type: BlockType
  reason: string | null
  is_active: boolean
  created_by: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface AppointmentWaitlistRow {
  id: string
  customer_id: string | null
  customer_name_snapshot: string | null
  customer_phone_snapshot: string | null
  desired_professional_id: string | null
  desired_service_id: string | null
  desired_date: string | null
  preferred_period: WaitlistPeriod | null
  status: WaitlistStatus
  notes: string | null
  converted_appointment_id: string | null
  created_at: string
  updated_at: string
}

export interface AppointmentCommandItemRow {
  id: string
  appointment_id: string
  item_type: CommandItemType
  service_id: string | null
  product_id: string | null
  description_snapshot: string
  quantity: number
  unit_price_snapshot: number
  total_price_snapshot: number
  professional_id: string | null
  created_at: string
  updated_at: string
}

// ── Extended Types (with relations) ──────────────────────

export type AppointmentWithRelations = AppointmentRow & {
  professional?: { id: string; name: string; display_name: string | null } | null
  customer?: { id: string; full_name: string; phone: string | null } | null
  service?: { id: string; name: string; price: number; duration_minutes: number } | null
}

export type ProfessionalForAgenda = {
  id: string
  name: string
  display_name: string | null
  is_active: boolean
  default_commission_percent: number | null
}

// ── Labels & Colors (PT-BR) ─────────────────────────────

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  checked_in: 'Check-in',
  completed: 'Finalizado',
  cancelled: 'Cancelado',
  no_show: 'Ausência',
  blocked: 'Bloqueado',
  encaixe: 'Encaixe',
}

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, { bg: string; text: string; border: string }> = {
  scheduled:  { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  confirmed:  { bg: 'rgba(168,85,247,0.12)', text: '#a78bfa', border: 'rgba(168,85,247,0.3)' },
  checked_in: { bg: 'rgba(6,182,212,0.12)',  text: '#22d3ee', border: 'rgba(6,182,212,0.3)' },
  completed:  { bg: 'rgba(16,185,129,0.12)', text: '#34d399', border: 'rgba(16,185,129,0.3)' },
  cancelled:  { bg: 'rgba(107,114,128,0.08)', text: '#6b7280', border: 'rgba(107,114,128,0.2)' },
  no_show:    { bg: 'rgba(239,68,68,0.12)',  text: '#f87171', border: 'rgba(239,68,68,0.3)' },
  blocked:    { bg: 'rgba(55,65,81,0.20)',   text: '#9ca3af', border: 'rgba(55,65,81,0.4)' },
  encaixe:    { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
}

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  manual: 'Bloqueio Manual',
  lunch: 'Almoço',
  meeting: 'Reunião',
  unavailable: 'Indisponível',
  recurring: 'Recorrente',
}

export const WAITLIST_STATUS_LABELS: Record<WaitlistStatus, string> = {
  waiting: 'Aguardando',
  contacted: 'Contatado',
  scheduled: 'Agendado',
  cancelled: 'Cancelado',
}

// ── Service Composition Types ────────────────────────────

/** Input for creating a customer appointment with optional addons */
export interface CustomerAppointmentCompositionInput {
  serviceId: string
  professionalId: string
  date: string
  startTime: string
  notes?: string
  /** Optional addon service IDs for composed booking */
  addonServiceIds?: string[]
}

export const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
}
