// ── Notification Module Types ───────────────────────────────
// Barber Zac ERP — Push Notifications

export type NotificationEventType =
  | 'appointment_created'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'appointment_checkin'
  | 'appointment_completed'
  | 'appointment_no_show'
  | 'subscription_closed'
  | 'subscription_cancelled'
  | 'subscription_payment_approved'
  | 'test_notification'

export type NotificationEntityType =
  | 'appointment'
  | 'subscription'
  | 'payment'
  | 'test'

export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export type PushPlatform = 'ios' | 'android' | 'desktop' | 'unknown'

export type PushRole = 'admin' | 'owner' | 'professional' | 'customer'

export type PermissionStatus = 'granted' | 'denied' | 'default'

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: Record<string, string>
  tag?: string
}

export interface NotificationTarget {
  userProfileId: string
  collaboratorId?: string | null
  role: PushRole
}

export interface SendResult {
  status: DeliveryStatus
  providerMessageId?: string
  error?: string
}

export interface PushSubscriptionInput {
  token: string
  endpoint?: string | null
  p256dh?: string | null
  authKey?: string | null
  platform: PushPlatform
  browser?: string | null
  deviceLabel?: string | null
  userAgent?: string | null
  isPwa: boolean
  permissionStatus: PermissionStatus
}

export interface NotificationPreferencesInput {
  notify_new_appointment?: boolean
  notify_cancelled_appointment?: boolean
  notify_rescheduled_appointment?: boolean
  notify_checkin?: boolean
  notify_completed?: boolean
  notify_no_show?: boolean
  notify_subscription_closed?: boolean
  notify_subscription_cancelled?: boolean
  quiet_hours_enabled?: boolean
  quiet_hours_start?: string | null
  quiet_hours_end?: string | null
}

export interface DispatchNotificationInput {
  eventType: NotificationEventType
  entityType: NotificationEntityType
  entityId: string
  idempotencyKey: string
  title: string
  body: string
  data?: Record<string, string>
  targets: NotificationTarget[]
  createdBy?: string | null
}

// ── Event-specific data passed to payload builders ──

export interface AppointmentNotificationData {
  appointmentId: string
  customerName: string
  serviceName?: string
  professionalName?: string
  professionalId?: string
  startTime?: string
  startDate?: string
  newStartTime?: string
  newStartDate?: string
}

export interface SubscriptionNotificationData {
  subscriptionId: string
  customerName: string
  planName?: string
  professionalName?: string
  professionalId?: string
  dayOfWeek?: string
  time?: string
}

// ── Preference check map ──

export const EVENT_TO_PREFERENCE_KEY: Record<NotificationEventType, string | null> = {
  appointment_created: 'notify_new_appointment',
  appointment_cancelled: 'notify_cancelled_appointment',
  appointment_rescheduled: 'notify_rescheduled_appointment',
  appointment_checkin: 'notify_checkin',
  appointment_completed: 'notify_completed',
  appointment_no_show: 'notify_no_show',
  subscription_closed: 'notify_subscription_closed',
  subscription_cancelled: 'notify_subscription_cancelled',
  subscription_payment_approved: 'notify_subscription_closed',
  test_notification: null, // always send
}
