// ── Client Notification Server Actions ──────────────────────
// Barber Zac ERP — Server actions for client notification inbox
"use server"

import { createServerClient } from '@/lib/supabase/server'
import { resolveUserProfileId } from '@/lib/supabase/resolve-user'

// ══════════════════════════════════════════════════════════
// GET CLIENT NOTIFICATIONS (inbox)
// ══════════════════════════════════════════════════════════

export async function getClientNotifications(limit = 20, offset = 0) {
  try {
    const supabase = await createServerClient()
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id
    if (!userId) return { success: false, error: 'Não autenticado.', data: [], total: 0 }

    const userProfileId = await resolveUserProfileId(supabase, userId)
    if (!userProfileId) return { success: false, error: 'Perfil não encontrado.', data: [], total: 0 }

    const { data: deliveryLogs, error, count } = await supabase
      .from('notification_delivery_logs')
      .select(`
        id,
        status,
        sent_at,
        created_at,
        notification_events:notification_event_id (
          id,
          event_type,
          entity_type,
          entity_id,
          title,
          body,
          data,
          created_at
        )
      `, { count: 'exact' })
      .eq('user_profile_id', userProfileId)
      .eq('target_role', 'customer')
      .in('status', ['sent', 'pending'])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const notifications = (deliveryLogs || []).map((d: Record<string, unknown>) => {
      const evt = d.notification_events as Record<string, unknown> | null
      return {
        id: d.id as string,
        deliveryId: d.id as string,
        eventId: (evt?.id || '') as string,
        eventType: (evt?.event_type || '') as string,
        entityType: (evt?.entity_type || '') as string,
        entityId: (evt?.entity_id || '') as string,
        title: (evt?.title || '') as string,
        body: (evt?.body || '') as string,
        data: (evt?.data || {}) as Record<string, unknown>,
        status: d.status as string,
        sentAt: (d.sent_at || d.created_at) as string,
        createdAt: (evt?.created_at || d.created_at) as string,
        isRead: false,
      }
    })

    return { success: true, data: notifications, total: count || 0 }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar notificações.'
    console.error('[ClientNotifications] Error:', message)
    return { success: false, error: message, data: [], total: 0 }
  }
}

// ══════════════════════════════════════════════════════════
// GET CLIENT UNREAD COUNT
// ══════════════════════════════════════════════════════════

export async function getClientUnreadCount() {
  try {
    const supabase = await createServerClient()
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id
    if (!userId) return { success: false, count: 0 }

    const userProfileId = await resolveUserProfileId(supabase, userId)
    if (!userProfileId) return { success: false, count: 0 }

    const { count, error } = await supabase
      .from('notification_delivery_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_profile_id', userProfileId)
      .eq('target_role', 'customer')
      .in('status', ['sent', 'pending'])

    if (error) throw error
    return { success: true, count: count || 0 }
  } catch {
    return { success: false, count: 0 }
  }
}

// ══════════════════════════════════════════════════════════
// GET CLIENT SUBSCRIPTION STATUS
// ══════════════════════════════════════════════════════════

export async function getClientSubscriptionStatus() {
  try {
    const supabase = await createServerClient()
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id
    if (!userId) return { success: false, hasActiveSubscription: false, deviceCount: 0 }

    const userProfileId = await resolveUserProfileId(supabase, userId)
    if (!userProfileId) return { success: false, hasActiveSubscription: false, deviceCount: 0 }

    const { count } = await supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_profile_id', userProfileId)
      .eq('is_active', true)

    return {
      success: true,
      hasActiveSubscription: (count || 0) > 0,
      deviceCount: count || 0,
    }
  } catch {
    return { success: false, hasActiveSubscription: false, deviceCount: 0 }
  }
}
