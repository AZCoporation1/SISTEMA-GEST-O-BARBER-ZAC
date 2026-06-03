// ── Notification Module Barrel Export ────────────────────────
// Barber Zac ERP — Re-exports for clean imports

// Components
export { NotificationSettingsCard } from './components/NotificationSettingsCard'
export { NotificationPreferencePanel } from './components/NotificationPreferencePanel'
export { NotificationDiagnosticsPanel } from './components/NotificationDiagnosticsPanel'
export { ProfessionalNotificationCard } from './components/ProfessionalNotificationCard'
export { ClientNotificationCard } from './components/ClientNotificationCard'
export { InstallPwaGuide } from './components/InstallPwaGuide'

// Types
export type {
  NotificationEventType,
  NotificationPreferencesInput,
  PushSubscriptionInput,
  NotificationTarget,
  PermissionStatus,
} from './types'
