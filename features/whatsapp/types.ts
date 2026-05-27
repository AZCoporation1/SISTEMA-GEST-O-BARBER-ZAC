/**
 * Barber Zac ERP — WhatsApp / Evolution API Types
 *
 * Types for all WhatsApp integration tables and provider interfaces.
 * API key and secrets are NEVER present in these types — they live in env vars.
 */

// ── Instance Status ──
export type InstanceStatus =
  | 'not_configured'
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'qr_pending'
  | 'error'
  | 'disabled'

// ── Message Direction ──
export type MessageDirection = 'inbound' | 'outbound'

// ── Message Status ──
export type MessageStatus =
  | 'received'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'ignored'

// ── Outbound Queue Status ──
export type OutboundStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'cancelled'

// ── Webhook Event Processing Status ──
export type WebhookProcessedStatus =
  | 'pending'
  | 'processed'
  | 'ignored'
  | 'failed'

// ── Agent Permission Scope ──
export type AgentScope =
  | 'agenda'
  | 'customers'
  | 'appointments'
  | 'services'
  | 'subscriptions'
  | 'sales_readonly'

// ── Table Row Types ──

export interface WhatsAppInstance {
  id: string
  instance_name: string
  display_name: string
  provider: string
  status: InstanceStatus
  phone_number: string | null
  profile_name: string | null
  webhook_url: string | null
  webhook_enabled: boolean
  last_qr_code: string | null
  last_qr_at: string | null
  last_connected_at: string | null
  last_disconnected_at: string | null
  last_error: string | null
  metadata: Record<string, unknown>
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface WhatsAppWebhookEvent {
  id: string
  provider: string
  instance_name: string
  event_id: string | null
  event_type: string
  remote_jid: string | null
  message_id: string | null
  direction: string | null
  raw_payload: Record<string, unknown>
  processed_status: WebhookProcessedStatus
  error_message: string | null
  received_at: string
  processed_at: string | null
}

export interface WhatsAppMessageLog {
  id: string
  instance_name: string
  direction: MessageDirection
  remote_jid: string
  phone_normalized: string | null
  customer_id: string | null
  appointment_id: string | null
  message_id: string | null
  message_type: string | null
  body: string | null
  status: MessageStatus
  intent: string | null
  agent_handled: boolean
  human_takeover: boolean
  raw_payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface WhatsAppOutboundMessage {
  id: string
  instance_name: string
  customer_id: string | null
  appointment_id: string | null
  remote_jid: string
  phone_normalized: string | null
  template_key: string | null
  message_body: string
  status: OutboundStatus
  scheduled_for: string | null
  sent_at: string | null
  failed_at: string | null
  error_message: string | null
  idempotency_key: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WhatsAppAgentPermission {
  id: string
  scope: AgentScope
  can_read: boolean
  can_write: boolean
  can_create_appointment: boolean
  can_cancel_appointment: boolean
  can_reschedule_appointment: boolean
  requires_human_confirmation: boolean
  is_enabled: boolean
  created_at: string
  updated_at: string
}

// ── Provider Response Types ──

export interface ProviderResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface ProviderStatus {
  enabled: boolean
  configured: boolean
  baseUrl: string | null
  instanceName: string | null
}

export interface InstanceConnectionState {
  state: 'open' | 'close' | 'connecting' | 'unknown'
  statusReason?: number
}

// ── Dashboard Aggregated Types ──

export interface WhatsAppDashboard {
  instance: WhatsAppInstance | null
  providerStatus: ProviderStatus
  recentEvents: WhatsAppWebhookEvent[]
  recentMessages: WhatsAppMessageLog[]
  queueCount: number
  permissions: WhatsAppAgentPermission[]
}
