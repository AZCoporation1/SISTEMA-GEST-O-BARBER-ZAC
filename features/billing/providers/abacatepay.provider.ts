/**
 * Barber Zac ERP — AbacatePay Provider (PLACEHOLDER)
 *
 * This is a placeholder implementation of the PaymentProvider interface.
 * All methods throw clear errors until the official AbacatePay API
 * documentation is provided and the integration is configured.
 *
 * DO NOT implement real API calls without official documentation.
 * DO NOT store card numbers, CVV, or sensitive authentication data.
 */

import type { PaymentProvider, CheckoutSessionInput, CheckoutSessionResult, CreateSubscriptionInput, CreateSubscriptionResult, CancelSubscriptionInput, WebhookEvent } from '../types'

const NOT_CONFIGURED_ERROR = 'AbacatePay ainda não configurado. Forneça API key e documentação oficial para ativar a integração de pagamento.'

function isEnabled(): boolean {
  return process.env.ABACATEPAY_ENABLED === 'true'
}

export const abacatePayProvider: PaymentProvider = {
  name: 'abacatepay',
  get isConfigured() {
    return isEnabled() && !!process.env.ABACATEPAY_API_KEY
  },

  async createCheckoutSession(_input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    if (!this.isConfigured) {
      throw new Error(NOT_CONFIGURED_ERROR)
    }
    // TODO: Implement real checkout session creation when docs are available
    // const response = await fetch(`${ABACATEPAY_BASE_URL}/checkout/sessions`, { ... })
    throw new Error(NOT_CONFIGURED_ERROR)
  },

  async createSubscription(_input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    if (!this.isConfigured) {
      throw new Error(NOT_CONFIGURED_ERROR)
    }
    throw new Error(NOT_CONFIGURED_ERROR)
  },

  async cancelSubscription(_input: CancelSubscriptionInput): Promise<{ success: boolean }> {
    if (!this.isConfigured) {
      throw new Error(NOT_CONFIGURED_ERROR)
    }
    throw new Error(NOT_CONFIGURED_ERROR)
  },

  async parseWebhook(_request: Request): Promise<WebhookEvent> {
    throw new Error(NOT_CONFIGURED_ERROR)
  },

  async verifyWebhookSignature(_request: Request): Promise<boolean> {
    throw new Error(NOT_CONFIGURED_ERROR)
  },
}
