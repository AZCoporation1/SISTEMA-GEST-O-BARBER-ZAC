// ── Notification Router Service ─────────────────────────────
// Barber Zac ERP — Core dispatching logic
// Server-side only — called from server actions
"use server"

import { createServerClient } from '@/lib/supabase/server'
import { getPushProvider } from './pushProvider'
import type {
  DispatchNotificationInput,
  NotificationTarget,
  PushPayload,
  SendResult,
  DeliveryStatus,
} from '../types'
import { EVENT_TO_PREFERENCE_KEY } from '../types'

/**
 * Main entry point: dispatch a notification to multiple targets.
 * - Creates idempotent notification_event
 * - Resolves push subscriptions per target
 * - Checks preferences and quiet hours
 * - Sends via push provider
 * - Logs delivery results
 *
 * NEVER throws — always best-effort with try/catch.
 */
export async function dispatchNotification(input: DispatchNotificationInput): Promise<void> {
  try {
    const supabase = await createServerClient()

    // ── 1. Idempotency: create notification_event ──
    const { data: existingEvent } = await supabase
      .from('notification_events')
      .select('id')
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle()

    if (existingEvent) {
      // Event already processed — skip
      return
    }

    const { data: notifEvent, error: eventErr } = await (supabase
      .from('notification_events') as any)
      .insert({
        event_type: input.eventType,
        entity_type: input.entityType,
        entity_id: input.entityId,
        idempotency_key: input.idempotencyKey,
        title: input.title,
        body: input.body,
        data: input.data || {},
        created_by: input.createdBy || null,
      })
      .select('id')
      .single()

    if (eventErr || !notifEvent) {
      // Unique constraint violation = already exists, skip
      if (eventErr?.code === '23505') return
      console.error('[NotificationRouter] Failed to create event:', eventErr)
      return
    }

    const eventId = (notifEvent as any).id

    // ── 2. Get push provider ──
    const provider = await getPushProvider()

    // ── 3. Process each target ──
    for (const target of input.targets) {
      try {
        await processTarget(supabase, provider, eventId, input, target)
      } catch (err) {
        console.error(`[NotificationRouter] Error processing target ${target.userProfileId}:`, err)
      }
    }
  } catch (err) {
    // NEVER throw — best effort
    console.error('[NotificationRouter] Dispatch failed:', err)
  }
}

/**
 * Process a single notification target:
 * 1. Check preferences
 * 2. Check quiet hours
 * 3. Get active subscriptions
 * 4. Send to each subscription
 * 5. Log results
 */
async function processTarget(
  supabase: any,
  provider: any,
  eventId: string,
  input: DispatchNotificationInput,
  target: NotificationTarget,
): Promise<void> {
  // ── Check user preferences ──
  const prefKey = EVENT_TO_PREFERENCE_KEY[input.eventType]

  if (prefKey) {
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_profile_id', target.userProfileId)
      .maybeSingle()

    if (prefs) {
      // Check if this event type is disabled
      if (prefs[prefKey] === false) {
        // User opted out — skip, but log
        await logSkippedForUser(supabase, eventId, target, 'User preference disabled')
        return
      }

      // Check quiet hours
      if (prefs.quiet_hours_enabled && prefs.quiet_hours_start && prefs.quiet_hours_end) {
        const now = new Date()
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

        if (isInQuietHours(currentTime, prefs.quiet_hours_start, prefs.quiet_hours_end)) {
          await logSkippedForUser(supabase, eventId, target, 'Quiet hours active')
          return
        }
      }
    }
    // If no prefs row exists, use defaults (send)
  }

  // ── Get active push subscriptions for this user ──
  const query = supabase
    .from('push_subscriptions')
    .select('id, token, provider, platform')
    .eq('user_profile_id', target.userProfileId)
    .eq('is_active', true)

  const { data: subscriptions } = await query

  if (!subscriptions || subscriptions.length === 0) {
    return // No active subscriptions — nothing to send
  }

  // ── Build payload with role-aware URL ──
  const payload: PushPayload = {
    title: input.title,
    body: input.body,
    icon: '/icons/ibz-192.png',
    badge: '/icons/ibz-192.png',
    tag: `${input.eventType}-${input.entityId}`,
    data: {
      ...input.data,
      url: input.data?.url || '/',
      eventType: input.eventType,
      entityId: input.entityId,
    },
  }

  // ── Send to each subscription ──
  for (const sub of subscriptions) {
    try {
      // Check if delivery already exists (idempotent)
      const { data: existingDelivery } = await supabase
        .from('notification_delivery_logs')
        .select('id')
        .eq('notification_event_id', eventId)
        .eq('push_subscription_id', sub.id)
        .maybeSingle()

      if (existingDelivery) continue // Already processed

      // Send via provider
      const result: SendResult = await provider.sendToToken(sub.token, payload)

      // Log delivery
      await supabase.from('notification_delivery_logs').insert({
        notification_event_id: eventId,
        push_subscription_id: sub.id,
        user_profile_id: target.userProfileId,
        collaborator_id: target.collaboratorId || null,
        target_role: target.role,
        status: result.status,
        provider: sub.provider || 'fcm',
        provider_message_id: result.providerMessageId || null,
        error_message: result.error || null,
        sent_at: result.status === 'sent' ? new Date().toISOString() : null,
      })

      // If token is invalid, deactivate it
      if (result.status === 'failed' && result.error?.includes('Invalid token')) {
        await supabase
          .from('push_subscriptions')
          .update({ is_active: false, revoked_at: new Date().toISOString() })
          .eq('id', sub.id)
      }
    } catch (err) {
      console.error(`[NotificationRouter] Send to subscription ${sub.id} failed:`, err)

      // Still log the failure
      try {
        await supabase.from('notification_delivery_logs').insert({
          notification_event_id: eventId,
          push_subscription_id: sub.id,
          user_profile_id: target.userProfileId,
          collaborator_id: target.collaboratorId || null,
          target_role: target.role,
          status: 'failed',
          provider: sub.provider || 'fcm',
          error_message: (err as Error)?.message || 'Unknown error',
        })
      } catch {
        // Swallow logging errors
      }
    }
  }
}

/**
 * Log skipped delivery for all subscriptions of a user.
 */
async function logSkippedForUser(
  supabase: any,
  eventId: string,
  target: NotificationTarget,
  reason: string,
): Promise<void> {
  try {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_profile_id', target.userProfileId)
      .eq('is_active', true)

    if (subs && subs.length > 0) {
      const logs = subs.map((sub: any) => ({
        notification_event_id: eventId,
        push_subscription_id: sub.id,
        user_profile_id: target.userProfileId,
        collaborator_id: target.collaboratorId || null,
        target_role: target.role,
        status: 'skipped' as DeliveryStatus,
        provider: 'fcm',
        error_message: reason,
      }))

      await supabase.from('notification_delivery_logs').insert(logs)
    }
  } catch {
    // Swallow — best effort
  }
}

/**
 * Check if current time falls within quiet hours.
 * Handles overnight ranges (e.g., 22:00 → 07:00).
 */
function isInQuietHours(currentTime: string, start: string, end: string): boolean {
  if (start <= end) {
    // Same-day range: 08:00 → 18:00
    return currentTime >= start && currentTime < end
  } else {
    // Overnight range: 22:00 → 07:00
    return currentTime >= start || currentTime < end
  }
}

/**
 * Resolve admin/owner targets — finds all users with admin/owner roles.
 */
export async function resolveAdminTargets(): Promise<NotificationTarget[]> {
  try {
    const supabase = await createServerClient()
    const { data: admins } = await supabase
      .from('user_profiles')
      .select('id, system_role, collaborator_id')
      .in('system_role', ['admin_total', 'owner_admin_professional'])
      .eq('is_active', true)

    if (!admins) return []

    return admins.map((a: any) => ({
      userProfileId: a.id,
      collaboratorId: a.collaborator_id,
      role: a.system_role === 'owner_admin_professional' ? 'owner' as const : 'admin' as const,
    }))
  } catch {
    return []
  }
}

/**
 * Resolve professional target — finds user_profile for a given collaborator_id.
 */
export async function resolveProfessionalTarget(
  collaboratorId: string
): Promise<NotificationTarget | null> {
  try {
    const supabase = await createServerClient()
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, collaborator_id')
      .eq('collaborator_id', collaboratorId)
      .eq('is_active', true)
      .maybeSingle()

    if (!profile) return null

    return {
      userProfileId: (profile as any).id,
      collaboratorId: (profile as any).collaborator_id,
      role: 'professional',
    }
  } catch {
    return null
  }
}
