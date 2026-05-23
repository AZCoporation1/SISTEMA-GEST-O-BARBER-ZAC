/**
 * Barber Zac ERP — AbacatePay Webhook Handler
 *
 * POST /api/webhooks/abacatepay
 *
 * Receives payment events from AbacatePay.
 * Currently returns 503 (Service Unavailable) since the gateway
 * is not yet configured. When docs are provided:
 * 1. Verify webhook signature
 * 2. Parse event
 * 3. Check idempotency (subscription_webhook_events)
 * 4. Process event (activate/cancel/renew subscription)
 * 5. Return 200
 */

import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // Feature flag check
  if (process.env.ABACATEPAY_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'Gateway de pagamento não configurada. Aguardando documentação AbacatePay.' },
      { status: 503 }
    )
  }

  try {
    // TODO: When AbacatePay docs are available:
    // 1. const isValid = await abacatePayProvider.verifyWebhookSignature(request)
    // 2. if (!isValid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    // 3. const event = await abacatePayProvider.parseWebhook(request)
    // 4. Check idempotency: SELECT FROM subscription_webhook_events WHERE event_id = event.eventId
    // 5. Process event based on event.eventType
    // 6. Record in subscription_webhook_events
    // 7. Return 200

    return NextResponse.json(
      { error: 'Webhook handler não implementado. Aguardando documentação da API.' },
      { status: 503 }
    )
  } catch (err: any) {
    console.error('[Webhook AbacatePay] Error:', err)
    return NextResponse.json(
      { error: 'Erro interno no processamento do webhook.' },
      { status: 500 }
    )
  }
}

// Block other methods
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
