// ── Push Provider Interface ─────────────────────────────────
// Barber Zac ERP — Abstract push provider for decoupled delivery
// Server-side only — imported by server actions

import type { PushPayload, SendResult } from '../types'

/**
 * Abstract interface for push notification providers.
 * Implementations: FCM, NoOp (fallback when provider not configured)
 */
export interface PushProvider {
  readonly name: string
  sendToToken(token: string, payload: PushPayload): Promise<SendResult>
  sendToMultiple(tokens: string[], payload: PushPayload): Promise<SendResult[]>
  validateToken(token: string): Promise<boolean>
}

/**
 * NoOp provider — used when FCM is not configured.
 * Logs skip status, never sends real notifications.
 */
export class NoOpPushProvider implements PushProvider {
  readonly name = 'noop'

  async sendToToken(_token: string, _payload: PushPayload): Promise<SendResult> {
    return { status: 'skipped', error: 'Push provider not configured (FCM_ENABLED=false)' }
  }

  async sendToMultiple(tokens: string[], _payload: PushPayload): Promise<SendResult[]> {
    return tokens.map(() => ({
      status: 'skipped' as const,
      error: 'Push provider not configured (FCM_ENABLED=false)',
    }))
  }

  async validateToken(_token: string): Promise<boolean> {
    return true // Can't validate without provider
  }
}

/**
 * Factory: returns the configured push provider or NoOp fallback.
 * Lazy-imports FCM to avoid loading firebase-admin when disabled.
 */
export async function getPushProvider(): Promise<PushProvider> {
  const enabled = process.env.FCM_ENABLED === 'true'
  if (!enabled) {
    return new NoOpPushProvider()
  }

  try {
    const { FCMPushProvider } = await import('./fcmProvider')
    return new FCMPushProvider()
  } catch (err) {
    console.warn('[PushProvider] Failed to load FCM provider, falling back to NoOp:', err)
    return new NoOpPushProvider()
  }
}
