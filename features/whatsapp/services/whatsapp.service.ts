/**
 * Barber Zac ERP — WhatsApp Service (Server-Only)
 *
 * Business logic for WhatsApp integration:
 * - Instance CRUD in whatsapp_instances
 * - Webhook event registration with idempotency
 * - Message log queries
 * - Outbound queue management
 * - Agent permission management
 */

import { createClient } from '@supabase/supabase-js'
import type {
  WhatsAppInstance,
  WhatsAppWebhookEvent,
  WhatsAppMessageLog,
  WhatsAppAgentPermission,
  InstanceStatus,
} from '../types'

// ── Admin client (service role, server-only) ──
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

// ══════════════════════════════════════════════
// INSTANCES
// ══════════════════════════════════════════════

export async function getOrCreateInstance(
  instanceName: string,
  displayName: string
): Promise<{ success: boolean; data?: WhatsAppInstance; error?: string }> {
  const supabase = getAdminClient()

  // Try to get existing
  const { data: existing } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('instance_name', instanceName)
    .single()

  if (existing) return { success: true, data: existing as WhatsAppInstance }

  // Create new
  const { data: created, error } = await supabase
    .from('whatsapp_instances')
    .insert({
      instance_name: instanceName,
      display_name: displayName,
      provider: 'evolution_api',
      status: 'not_configured' as InstanceStatus,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[WhatsAppService] getOrCreateInstance error:', error)
    return { success: false, error: 'Erro ao criar instância.' }
  }

  return { success: true, data: created as WhatsAppInstance }
}

export async function getInstance(instanceName: string): Promise<WhatsAppInstance | null> {
  const supabase = getAdminClient()
  const { data } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('instance_name', instanceName)
    .single()
  return (data as WhatsAppInstance) || null
}

export async function updateInstanceStatus(
  instanceName: string,
  status: InstanceStatus,
  extra?: Partial<WhatsAppInstance>
): Promise<boolean> {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('whatsapp_instances')
    .update({ status, ...extra, updated_at: new Date().toISOString() })
    .eq('instance_name', instanceName)

  if (error) {
    console.error('[WhatsAppService] updateInstanceStatus error:', error)
    return false
  }
  return true
}

// ══════════════════════════════════════════════
// WEBHOOK EVENTS (with idempotency)
// ══════════════════════════════════════════════

export async function registerWebhookEvent(event: {
  provider?: string
  instance_name: string
  event_id?: string | null
  event_type: string
  remote_jid?: string | null
  message_id?: string | null
  direction?: string | null
  raw_payload: Record<string, unknown>
}): Promise<{ success: boolean; duplicate?: boolean; id?: string; error?: string }> {
  const supabase = getAdminClient()

  // Idempotency check: if event_id exists, check for duplicates
  if (event.event_id) {
    const { data: existing } = await supabase
      .from('whatsapp_webhook_events')
      .select('id')
      .eq('provider', event.provider || 'evolution_api')
      .eq('event_id', event.event_id)
      .single()

    if (existing) {
      return { success: true, duplicate: true, id: existing.id }
    }
  }

  const { data, error } = await supabase
    .from('whatsapp_webhook_events')
    .insert({
      provider: event.provider || 'evolution_api',
      instance_name: event.instance_name,
      event_id: event.event_id || null,
      event_type: event.event_type,
      remote_jid: event.remote_jid || null,
      message_id: event.message_id || null,
      direction: event.direction || null,
      raw_payload: event.raw_payload,
      processed_status: 'pending',
      received_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[WhatsAppService] registerWebhookEvent error:', error)
    return { success: false, error: 'Erro ao registrar evento.' }
  }

  return { success: true, duplicate: false, id: data?.id }
}

export async function getRecentWebhookEvents(
  limit: number = 20
): Promise<WhatsAppWebhookEvent[]> {
  const supabase = getAdminClient()
  const { data } = await supabase
    .from('whatsapp_webhook_events')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(limit)

  return (data as WhatsAppWebhookEvent[]) || []
}

// ══════════════════════════════════════════════
// MESSAGE LOGS
// ══════════════════════════════════════════════

export async function getMessageLogs(opts: {
  limit?: number
  offset?: number
  direction?: string
  search?: string
}): Promise<{ data: WhatsAppMessageLog[]; total: number }> {
  const supabase = getAdminClient()
  const limit = opts.limit || 30
  const offset = opts.offset || 0

  let query = supabase
    .from('whatsapp_message_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts.direction) {
    query = query.eq('direction', opts.direction)
  }

  if (opts.search) {
    query = query.or(`phone_normalized.ilike.%${opts.search}%,body.ilike.%${opts.search}%,remote_jid.ilike.%${opts.search}%`)
  }

  const { data, count, error } = await query

  if (error) {
    console.error('[WhatsAppService] getMessageLogs error:', error)
    return { data: [], total: 0 }
  }

  return { data: (data as WhatsAppMessageLog[]) || [], total: count || 0 }
}

// ══════════════════════════════════════════════
// OUTBOUND QUEUE
// ══════════════════════════════════════════════

export async function getOutboundQueue(limit: number = 20): Promise<{
  data: Array<Record<string, unknown>>
  total: number
}> {
  const supabase = getAdminClient()
  const { data, count } = await supabase
    .from('whatsapp_outbound_queue')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(limit)

  return { data: data || [], total: count || 0 }
}

// ══════════════════════════════════════════════
// AGENT PERMISSIONS
// ══════════════════════════════════════════════

export async function getAgentPermissions(): Promise<WhatsAppAgentPermission[]> {
  const supabase = getAdminClient()
  const { data } = await supabase
    .from('whatsapp_agent_permissions')
    .select('*')
    .order('scope')

  return (data as WhatsAppAgentPermission[]) || []
}

export async function updateAgentPermission(
  id: string,
  updates: Partial<WhatsAppAgentPermission>
): Promise<{ success: boolean; error?: string }> {
  const supabase = getAdminClient()

  // Remove fields that shouldn't be updated directly
  const { id: _id, created_at: _ca, updated_at: _ua, scope: _scope, ...safeUpdates } = updates as any

  const { error } = await supabase
    .from('whatsapp_agent_permissions')
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[WhatsAppService] updateAgentPermission error:', error)
    return { success: false, error: 'Erro ao atualizar permissão.' }
  }

  return { success: true }
}

/**
 * Seed default agent permissions if table is empty.
 * Called once when dashboard loads.
 */
export async function seedDefaultPermissions(): Promise<void> {
  const supabase = getAdminClient()
  const { count } = await supabase
    .from('whatsapp_agent_permissions')
    .select('id', { count: 'exact', head: true })

  if (count && count > 0) return

  const defaults = [
    { scope: 'agenda', can_read: true, can_write: false, can_create_appointment: false, can_cancel_appointment: false, can_reschedule_appointment: false, requires_human_confirmation: true, is_enabled: true },
    { scope: 'customers', can_read: true, can_write: false, can_create_appointment: false, can_cancel_appointment: false, can_reschedule_appointment: false, requires_human_confirmation: true, is_enabled: true },
    { scope: 'appointments', can_read: true, can_write: false, can_create_appointment: false, can_cancel_appointment: false, can_reschedule_appointment: false, requires_human_confirmation: true, is_enabled: true },
    { scope: 'services', can_read: true, can_write: false, can_create_appointment: false, can_cancel_appointment: false, can_reschedule_appointment: false, requires_human_confirmation: true, is_enabled: true },
    { scope: 'subscriptions', can_read: true, can_write: false, can_create_appointment: false, can_cancel_appointment: false, can_reschedule_appointment: false, requires_human_confirmation: true, is_enabled: true },
    { scope: 'sales_readonly', can_read: true, can_write: false, can_create_appointment: false, can_cancel_appointment: false, can_reschedule_appointment: false, requires_human_confirmation: true, is_enabled: false },
  ]

  await supabase.from('whatsapp_agent_permissions').insert(defaults)
}
