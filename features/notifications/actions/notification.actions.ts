// ── Notification Server Actions ─────────────────────────────
// Barber Zac ERP — Server actions for push subscription management
// @ts-nocheck
"use server"

import { createServerClient } from '@/lib/supabase/server'
import { resolveUserProfileId } from '@/lib/supabase/resolve-user'
import { logAudit } from '@/features/audit/actions/audit.actions'
import { getPushProvider } from '../services/pushProvider'
import { buildTestNotificationPayload } from '../services/eventPayloads'
import type {
  PushSubscriptionInput,
  NotificationPreferencesInput,
  PushRole,
} from '../types'

// ── Helpers ─────────────────────────────────────────────

async function getUserContext(supabase: any) {
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData.user?.id
  const userProfileId = await resolveUserProfileId(supabase, userId)

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('system_role, collaborator_id')
    .eq('auth_user_id', userId)
    .single()

  // Resolve customer_id: check if there's a customer linked to this auth user
  let customerId: string | null = null
  if (userId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', userId)
      .maybeSingle()
    if (customer) customerId = customer.id
  }

  return {
    userId,
    userProfileId,
    systemRole: profile?.system_role || 'unknown',
    collaboratorId: profile?.collaborator_id || null,
    customerId,
    hasAdminAccess: ['admin_total', 'owner_admin_professional'].includes(profile?.system_role || ''),
  }
}

function resolveRole(systemRole: string): PushRole {
  switch (systemRole) {
    case 'admin_total': return 'admin'
    case 'owner_admin_professional': return 'owner'
    case 'professional': return 'professional'
    case 'unknown': return 'customer'
    default: return 'professional'
  }
}

// ══════════════════════════════════════════════════════════
// REGISTER PUSH SUBSCRIPTION
// ══════════════════════════════════════════════════════════

export async function registerPushSubscription(data: PushSubscriptionInput) {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    if (!ctx.userProfileId) {
      return { success: false, error: 'Usuário não identificado.' }
    }

    const role = resolveRole(ctx.systemRole)

    // Check if this token already exists for this provider
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id, user_profile_id, is_active')
      .eq('provider', 'fcm')
      .eq('token', data.token)
      .maybeSingle()

    if (existing) {
      // Token already registered — update it
      const { error: updateErr } = await supabase
        .from('push_subscriptions')
        .update({
          user_profile_id: ctx.userProfileId,
          collaborator_id: ctx.collaboratorId,
          customer_id: ctx.customerId,
          role,
          platform: data.platform,
          browser: data.browser,
          device_label: data.deviceLabel,
          user_agent: data.userAgent,
          is_pwa: data.isPwa,
          permission_status: data.permissionStatus,
          is_active: true,
          last_seen_at: new Date().toISOString(),
          revoked_at: null,
          endpoint: data.endpoint || null,
          p256dh: data.p256dh || null,
          auth_key: data.authKey || null,
        })
        .eq('id', existing.id)

      if (updateErr) throw updateErr

      return { success: true, subscriptionId: existing.id, action: 'updated' }
    }

    // New subscription
    const { data: newSub, error: insertErr } = await supabase
      .from('push_subscriptions')
      .insert({
        user_profile_id: ctx.userProfileId,
        collaborator_id: ctx.collaboratorId,
        customer_id: ctx.customerId,
        role,
        provider: 'fcm',
        token: data.token,
        endpoint: data.endpoint || null,
        p256dh: data.p256dh || null,
        auth_key: data.authKey || null,
        platform: data.platform,
        browser: data.browser,
        device_label: data.deviceLabel,
        user_agent: data.userAgent,
        is_pwa: data.isPwa,
        permission_status: data.permissionStatus,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertErr) throw insertErr

    await logAudit({
      action: 'INSERT',
      entity: 'push_subscriptions',
      entity_id: newSub.id,
      observation: `Push subscription registrada: ${data.platform} / ${data.browser || 'unknown'}`,
    })

    return { success: true, subscriptionId: newSub.id, action: 'created' }
  } catch (err: any) {
    console.error('[Notification] Register push subscription error:', err)
    return { success: false, error: err.message || 'Erro ao registrar dispositivo.' }
  }
}

// ══════════════════════════════════════════════════════════
// UNREGISTER PUSH SUBSCRIPTION
// ══════════════════════════════════════════════════════════

export async function unregisterPushSubscription(subscriptionId: string) {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    const { error } = await supabase
      .from('push_subscriptions')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)
      .eq('user_profile_id', ctx.userProfileId) // Security: only own subscriptions

    if (error) throw error

    await logAudit({
      action: 'UPDATE',
      entity: 'push_subscriptions',
      entity_id: subscriptionId,
      observation: 'Push subscription desativada pelo usuário',
    })

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao desativar notificações.' }
  }
}

// ══════════════════════════════════════════════════════════
// UNREGISTER BY TOKEN (client helper)
// ══════════════════════════════════════════════════════════

export async function unregisterPushSubscriptionByToken(token: string) {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    const { error } = await supabase
      .from('push_subscriptions')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
      })
      .eq('token', token)
      .eq('user_profile_id', ctx.userProfileId)

    if (error) throw error

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao desativar.' }
  }
}

// ══════════════════════════════════════════════════════════
// UPDATE NOTIFICATION PREFERENCES
// ══════════════════════════════════════════════════════════

export async function updateNotificationPreferences(prefs: NotificationPreferencesInput) {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    if (!ctx.userProfileId) {
      return { success: false, error: 'Usuário não identificado.' }
    }

    // Upsert preferences
    const { data: existing } = await supabase
      .from('notification_preferences')
      .select('id')
      .eq('user_profile_id', ctx.userProfileId)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('notification_preferences')
        .update(prefs)
        .eq('id', existing.id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('notification_preferences')
        .insert({ user_profile_id: ctx.userProfileId, ...prefs })

      if (error) throw error
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao salvar preferências.' }
  }
}

// ══════════════════════════════════════════════════════════
// GET MY NOTIFICATION PREFERENCES
// ══════════════════════════════════════════════════════════

export async function getMyNotificationPreferences() {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_profile_id', ctx.userProfileId)
      .maybeSingle()

    return {
      success: true,
      data: data || {
        notify_new_appointment: true,
        notify_cancelled_appointment: true,
        notify_rescheduled_appointment: true,
        notify_checkin: true,
        notify_completed: false,
        notify_no_show: true,
        notify_subscription_closed: true,
        notify_subscription_cancelled: true,
        quiet_hours_enabled: false,
        quiet_hours_start: null,
        quiet_hours_end: null,
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message, data: null }
  }
}

// ══════════════════════════════════════════════════════════
// GET MY PUSH SUBSCRIPTIONS
// ══════════════════════════════════════════════════════════

export async function getMyPushSubscriptions() {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    const { data } = await supabase
      .from('push_subscriptions')
      .select('id, platform, browser, device_label, is_pwa, is_active, permission_status, last_seen_at, created_at')
      .eq('user_profile_id', ctx.userProfileId)
      .order('created_at', { ascending: false })

    return { success: true, data: data || [] }
  } catch (err: any) {
    return { success: false, error: err.message, data: [] }
  }
}

// ══════════════════════════════════════════════════════════
// SEND TEST NOTIFICATION (to self)
// ══════════════════════════════════════════════════════════

export async function sendTestNotification() {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, token, provider')
      .eq('user_profile_id', ctx.userProfileId)
      .eq('is_active', true)

    if (!subs || subs.length === 0) {
      return { success: false, error: 'Nenhum dispositivo registrado.' }
    }

    const provider = await getPushProvider()
    const payload = buildTestNotificationPayload()
    let sentCount = 0
    const errors: string[] = []

    for (const sub of subs) {
      const result = await provider.sendToToken(sub.token, payload)
      if (result.status === 'sent') {
        sentCount++
      } else if (result.error) {
        errors.push(result.error)
      }

      // Log the test delivery
      await supabase.from('notification_events').insert({
        event_type: 'test_notification',
        entity_type: 'test',
        entity_id: ctx.userProfileId,
        idempotency_key: `test:${ctx.userProfileId}:${sub.id}:${Date.now()}`,
        title: payload.title,
        body: payload.body,
        data: {},
        created_by: ctx.userProfileId,
      }).then(({ data: evt }) => {
        if (evt) {
          supabase.from('notification_delivery_logs').insert({
            notification_event_id: evt.id,
            push_subscription_id: sub.id,
            user_profile_id: ctx.userProfileId,
            target_role: resolveRole(ctx.systemRole),
            status: result.status,
            provider: sub.provider || 'fcm',
            provider_message_id: result.providerMessageId || null,
            error_message: result.error || null,
            sent_at: result.status === 'sent' ? new Date().toISOString() : null,
          })
        }
      }).catch(() => {})
    }

    return {
      success: true,
      message: sentCount > 0
        ? `Teste enviado para ${sentCount} dispositivo(s).`
        : `Falha no envio: ${errors.join('; ') || 'Verifique se o FCM está configurado.'}`,
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao enviar teste.' }
  }
}

// ══════════════════════════════════════════════════════════
// SEND TEST NOTIFICATION TO USER (Admin only)
// ══════════════════════════════════════════════════════════

export async function sendTestNotificationToUser(targetUserProfileId: string) {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    if (!ctx.hasAdminAccess) {
      return { success: false, error: 'Apenas administradores podem enviar testes para outros usuários.' }
    }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, token, provider')
      .eq('user_profile_id', targetUserProfileId)
      .eq('is_active', true)

    if (!subs || subs.length === 0) {
      return { success: false, error: 'Usuário não possui dispositivos registrados.' }
    }

    const provider = await getPushProvider()
    const payload = buildTestNotificationPayload()
    let sentCount = 0

    for (const sub of subs) {
      const result = await provider.sendToToken(sub.token, payload)
      if (result.status === 'sent') sentCount++
    }

    return {
      success: true,
      message: `Teste enviado para ${sentCount} de ${subs.length} dispositivo(s).`,
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao enviar teste.' }
  }
}

// ══════════════════════════════════════════════════════════
// GET NOTIFICATION DIAGNOSTICS (Admin only)
// ══════════════════════════════════════════════════════════

export async function getNotificationDiagnostics() {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    if (!ctx.hasAdminAccess) {
      return { success: false, error: 'Acesso restrito.', data: null }
    }

    // All subscriptions with user info
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select(`
        id, user_profile_id, collaborator_id, role, provider, platform, browser,
        device_label, is_pwa, permission_status, is_active, last_seen_at, created_at,
        user_profiles:user_profile_id (full_name, display_name, email, system_role)
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    // Recent delivery logs
    const { data: recentLogs } = await supabase
      .from('notification_delivery_logs')
      .select(`
        id, status, provider, provider_message_id, error_message, sent_at, created_at,
        target_role,
        notification_events:notification_event_id (event_type, title, body, entity_id),
        push_subscriptions:push_subscription_id (platform, browser, device_label),
        user_profiles:user_profile_id (full_name, display_name)
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    // Stats
    const { count: totalActive } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    const { count: totalSent } = await supabase
      .from('notification_delivery_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')

    const { count: totalFailed } = await supabase
      .from('notification_delivery_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')

    return {
      success: true,
      data: {
        subscriptions: subscriptions || [],
        recentLogs: recentLogs || [],
        stats: {
          activeDevices: totalActive || 0,
          totalSent: totalSent || 0,
          totalFailed: totalFailed || 0,
        },
        fcmEnabled: process.env.FCM_ENABLED === 'true',
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message, data: null }
  }
}
