/**
 * Barber Zac ERP — Subscription Module Types
 *
 * Database row types and constants for the monthly subscription system.
 * Tables: subscription_plans, subscription_plan_professionals,
 *         customer_subscriptions, subscription_occurrences,
 *         subscription_payments, subscription_webhook_events
 */

// ── Subscription Status Enums ────────────────────────────────

export type SubscriptionStatus =
  | 'draft'
  | 'pending_payment'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired'
  | 'failed'

export type OccurrenceStatus =
  | 'scheduled'
  | 'used'
  | 'skipped'
  | 'conflict'
  | 'cancelled'
  | 'failed'

export type SubscriptionPaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'cancelled'

export type PaymentMethodType = 'card' | 'pix' | 'pix_automatic'

// ── Visit Template ───────────────────────────────────────────

export interface VisitTemplateEntry {
  index: number
  items: string[]  // e.g. ["corte", "sobrancelha"]
}

// ── Table Row Types ──────────────────────────────────────────

export interface SubscriptionPlanRow {
  id: string
  source_service_id: string | null
  name: string
  display_name: string
  slug: string
  plan_number: number | null
  monthly_price: number
  duration_minutes_per_visit: number
  visits_per_cycle: number
  included_services_json: Record<string, any> | null
  visit_template_json: VisitTemplateEntry[]
  professional_scope: string | null   // 'zac' | 'gustavo_matheus' | 'all'
  needs_manual_review: boolean
  imported_from_service: boolean
  is_active: boolean
  show_in_customer_portal: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SubscriptionPlanProfessionalRow {
  plan_id: string
  professional_id: string
}

export interface CustomerSubscriptionRow {
  id: string
  customer_id: string
  plan_id: string
  status: SubscriptionStatus
  fixed_weekday: number          // 0=dom, 1=seg, ..., 6=sab
  fixed_time: string             // "HH:MM"
  preferred_professional_id: string | null
  current_period_start: string   // date
  current_period_end: string     // date
  starts_at: string              // timestamptz
  ends_at: string | null         // timestamptz
  cancelled_at: string | null
  cancellation_reason: string | null
  // Payment provider
  payment_provider: string       // 'placeholder' | 'abacatepay'
  provider_customer_id: string | null
  provider_subscription_id: string | null
  provider_checkout_id: string | null
  provider_checkout_url: string | null
  payment_method: PaymentMethodType | null
  // Activation
  activated_manually: boolean
  activated_by: string | null
  activated_at: string | null
  checkout_mode: string          // 'placeholder' | 'abacatepay'
  // Consent
  terms_accepted_at: string | null
  recurring_authorization_accepted_at: string | null
  // Discount
  subscriber_discount_percent: number   // default 7
  // Metadata
  metadata: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface SubscriptionOccurrenceRow {
  id: string
  subscription_id: string
  appointment_id: string | null
  occurrence_date: string        // date
  occurrence_start_at: string    // timestamptz
  occurrence_end_at: string      // timestamptz
  occurrence_index: number
  status: OccurrenceStatus
  template_items_json: string[]  // items for this visit e.g. ["corte", "barba"]
  visit_label: string | null     // e.g. "Visita 1: Corte + Barba"
  used_at: string | null
  used_by: string | null
  consumed_by_status: string | null  // 'checked_in' | 'completed'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SubscriptionPaymentRow {
  id: string
  subscription_id: string
  customer_id: string
  provider: string
  provider_payment_id: string | null
  provider_invoice_id: string | null
  amount: number
  status: SubscriptionPaymentStatus
  payment_method: string | null
  due_at: string | null
  paid_at: string | null
  raw_event: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface SubscriptionWebhookEventRow {
  id: string
  provider: string
  event_id: string
  event_type: string
  processed_at: string | null
  raw_payload: Record<string, any> | null
  status: string
  error_message: string | null
  created_at: string
}

// ── Display Constants ────────────────────────────────────────

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  draft: 'Rascunho',
  pending_payment: 'Aguardando Pagamento',
  active: 'Ativa',
  past_due: 'Pagamento Atrasado',
  cancelled: 'Cancelada',
  expired: 'Expirada',
  failed: 'Falha',
}

export const SUBSCRIPTION_STATUS_COLORS: Record<SubscriptionStatus, string> = {
  draft: '#6b7280',
  pending_payment: '#f59e0b',
  active: '#10b981',
  past_due: '#ef4444',
  cancelled: '#6b7280',
  expired: '#6b7280',
  failed: '#ef4444',
}

export const OCCURRENCE_STATUS_LABELS: Record<OccurrenceStatus, string> = {
  scheduled: 'Agendado',
  used: 'Utilizado',
  skipped: 'Pulado',
  conflict: 'Conflito',
  cancelled: 'Cancelado',
  failed: 'Falha',
}

export const WEEKDAY_NAMES = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado',
] as const

// ── Enriched types (with joins) ──────────────────────────────

export interface SubscriptionPlanWithProfessionals extends SubscriptionPlanRow {
  professionals: Array<{
    id: string
    name: string
    display_name: string | null
  }>
}

export interface CustomerSubscriptionWithPlan extends CustomerSubscriptionRow {
  plan: SubscriptionPlanRow
  occurrences?: SubscriptionOccurrenceRow[]
  customer?: {
    id: string
    full_name: string
    phone: string | null
    email: string | null
  }
}
