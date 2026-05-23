/**
 * Barber Zac ERP — Payment Provider Abstraction
 *
 * Interface and types for payment gateway integration.
 * Designed to be provider-agnostic — currently targets AbacatePay.
 *
 * IMPORTANT: Do NOT implement real API calls without official documentation.
 */

// ── Types ────────────────────────────────────────────────────

export interface CheckoutSessionInput {
  customerId: string
  customerEmail: string
  customerName: string
  customerCpf?: string
  subscriptionPlanId: string
  planName: string
  amount: number              // in BRL cents
  paymentMethod: 'card' | 'pix' | 'pix_automatic'
  metadata?: Record<string, any>
}

export interface CheckoutSessionResult {
  checkoutId: string
  checkoutUrl: string
  providerCustomerId?: string
  expiresAt?: string
}

export interface CreateSubscriptionInput {
  providerCustomerId: string
  planName: string
  amount: number
  paymentMethod: 'card' | 'pix' | 'pix_automatic'
  metadata?: Record<string, any>
}

export interface CreateSubscriptionResult {
  providerSubscriptionId: string
  status: string
}

export interface CancelSubscriptionInput {
  providerSubscriptionId: string
  reason?: string
}

export interface WebhookEvent {
  eventId: string
  eventType: string
  payload: Record<string, any>
  timestamp?: string
}

export interface WebhookProcessResult {
  success: boolean
  eventId: string
  action?: string
  error?: string
}

// ── Provider Interface ───────────────────────────────────────

export interface PaymentProvider {
  readonly name: string
  readonly isConfigured: boolean

  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult>
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>
  cancelSubscription(input: CancelSubscriptionInput): Promise<{ success: boolean }>
  parseWebhook(request: Request): Promise<WebhookEvent>
  verifyWebhookSignature(request: Request): Promise<boolean>
}
