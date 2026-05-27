/**
 * Barber Zac ERP — Evolution API Webhook Handler
 *
 * POST /api/webhooks/evolution
 *
 * Receives events from Evolution API v2.
 * Security:
 * - Validates WHATSAPP_WEBHOOK_SECRET if configured
 * - Registers raw event with idempotency
 * - Never modifies agenda directly
 * - Returns 200 for valid events, 401 for bad secret, 500 for errors
 */

import { NextResponse } from 'next/server'
import { registerWebhookEvent } from '@/features/whatsapp/services/whatsapp.service'

export async function POST(request: Request) {
  try {
    // ── 1. Validate webhook secret ──
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET
    if (secret) {
      const headerSecret =
        request.headers.get('x-webhook-secret') ||
        request.headers.get('authorization')?.replace('Bearer ', '')

      if (headerSecret !== secret) {
        console.warn('[Webhook Evolution] Invalid secret received')
        return NextResponse.json(
          { error: 'Unauthorized: invalid webhook secret.' },
          { status: 401 }
        )
      }
    }

    // ── 2. Parse body ──
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body.' },
        { status: 400 }
      )
    }

    // ── 3. Extract event metadata ──
    // Evolution API v2 sends events with various structures.
    // We extract what we can and store the rest in raw_payload.
    const eventType = (body.event as string) || (body.type as string) || 'unknown'
    const instanceName =
      (body.instance as string) ||
      (body.instanceName as string) ||
      process.env.EVOLUTION_API_INSTANCE_NAME ||
      'barber-zac'

    // Try to extract identifiers for idempotency
    const eventId =
      (body.id as string) ||
      (body.eventId as string) ||
      null

    const messageData = body.data as Record<string, unknown> | undefined
    const remoteJid =
      (messageData?.key as any)?.remoteJid ||
      (body.remoteJid as string) ||
      null

    const messageId =
      (messageData?.key as any)?.id ||
      (body.messageId as string) ||
      null

    const direction =
      (messageData?.key as any)?.fromMe === true ? 'outbound' :
      (messageData?.key as any)?.fromMe === false ? 'inbound' :
      null

    // ── 4. Register event (with idempotency) ──
    const result = await registerWebhookEvent({
      provider: 'evolution_api',
      instance_name: instanceName,
      event_id: eventId,
      event_type: eventType,
      remote_jid: remoteJid,
      message_id: messageId,
      direction,
      raw_payload: body,
    })

    if (!result.success) {
      console.error('[Webhook Evolution] Failed to register event:', result.error)
      return NextResponse.json(
        { error: 'Internal error processing webhook.' },
        { status: 500 }
      )
    }

    if (result.duplicate) {
      console.log(`[Webhook Evolution] Duplicate event ignored: ${eventId}`)
      return NextResponse.json({ status: 'duplicate', id: result.id })
    }

    console.log(`[Webhook Evolution] Event registered: ${eventType} (${result.id})`)

    // ── 5. Return success ──
    // Future: process specific event types (messages, connection updates, etc.)
    // For now, just store and acknowledge.
    return NextResponse.json({
      status: 'received',
      id: result.id,
      event_type: eventType,
    })
  } catch (err: any) {
    console.error('[Webhook Evolution] Unhandled error:', err)
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    )
  }
}

// Block other methods
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
