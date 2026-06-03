// ── Push Client Helper ──────────────────────────────────────
// Barber Zac ERP — Browser-side push notification utilities
// Called from UI components on user interaction (click only)

import { getFCMToken, deleteFCMToken, isFirebaseConfigured } from './firebaseClient'
import { registerPushSubscription, unregisterPushSubscriptionByToken } from '../actions/notification.actions'
import type { PushPlatform, PermissionStatus } from '../types'

/**
 * Detect if the browser supports push notifications.
 */
export function detectPushSupport(): {
  supported: boolean
  hasServiceWorker: boolean
  hasNotification: boolean
  hasPushManager: boolean
  reason?: string
} {
  if (typeof window === 'undefined') {
    return { supported: false, hasServiceWorker: false, hasNotification: false, hasPushManager: false, reason: 'SSR' }
  }

  const hasServiceWorker = 'serviceWorker' in navigator
  const hasNotification = 'Notification' in window
  const hasPushManager = 'PushManager' in window

  const supported = hasServiceWorker && hasNotification && hasPushManager

  return {
    supported,
    hasServiceWorker,
    hasNotification,
    hasPushManager,
    reason: !supported
      ? `Faltando: ${[
          !hasServiceWorker && 'Service Worker',
          !hasNotification && 'Notification API',
          !hasPushManager && 'Push API',
        ]
          .filter(Boolean)
          .join(', ')}`
      : undefined,
  }
}

/**
 * Detect the current platform.
 */
export function detectPlatform(): PushPlatform {
  if (typeof navigator === 'undefined') return 'unknown'

  const ua = navigator.userAgent.toLowerCase()

  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'desktop'
}

/**
 * Detect the browser name.
 */
export function detectBrowser(): string {
  if (typeof navigator === 'undefined') return 'unknown'

  const ua = navigator.userAgent
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('SamsungBrowser')) return 'Samsung Browser'
  if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera'
  if (ua.includes('Edg')) return 'Edge'
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Safari')) return 'Safari'
  return 'unknown'
}

/**
 * Check if the app is installed as a PWA (standalone mode).
 */
export function isInstalledAsPWA(): boolean {
  if (typeof window === 'undefined') return false

  // iOS standalone check
  if ('standalone' in (navigator as any) && (navigator as any).standalone) return true

  // Standard display-mode check
  return window.matchMedia('(display-mode: standalone)').matches
}

/**
 * Check if on iOS and whether PWA install is needed for push.
 */
export function getIOSPushStatus(): {
  isIOS: boolean
  isPWAInstalled: boolean
  canUsePush: boolean
  needsInstall: boolean
} {
  const isIOS = detectPlatform() === 'ios'
  const isPWAInstalled = isInstalledAsPWA()

  return {
    isIOS,
    isPWAInstalled,
    canUsePush: !isIOS || isPWAInstalled, // iOS needs PWA installed
    needsInstall: isIOS && !isPWAInstalled,
  }
}

/**
 * Get current notification permission status.
 */
export function getPermissionStatus(): PermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default'
  return Notification.permission as PermissionStatus
}

/**
 * Check if Firebase client is configured.
 */
export function isProviderConfigured(): boolean {
  return isFirebaseConfigured()
}

/**
 * Request push notification permission and register token.
 * MUST be called from a user gesture (click handler).
 *
 * Returns the registration result.
 */
export async function requestAndRegisterPush(): Promise<{
  success: boolean
  error?: string
  permissionStatus: PermissionStatus
}> {
  // 1. Request permission
  const permission = await Notification.requestPermission()

  if (permission !== 'granted') {
    return {
      success: false,
      error: permission === 'denied'
        ? 'Permissão negada. Você pode habilitar nas configurações do navegador.'
        : 'Permissão não foi concedida.',
      permissionStatus: permission as PermissionStatus,
    }
  }

  // 2. Get FCM token
  const token = await getFCMToken()

  if (!token) {
    return {
      success: false,
      error: 'Não foi possível obter o token de notificação. Verifique se o Firebase está configurado.',
      permissionStatus: 'granted',
    }
  }

  // 3. Register with backend
  const platform = detectPlatform()
  const browser = detectBrowser()
  const isPwa = isInstalledAsPWA()

  const result = await registerPushSubscription({
    token,
    platform,
    browser,
    deviceLabel: `${browser} / ${platform}`,
    userAgent: navigator.userAgent,
    isPwa,
    permissionStatus: 'granted',
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Erro ao registrar dispositivo.',
      permissionStatus: 'granted',
    }
  }

  return {
    success: true,
    permissionStatus: 'granted',
  }
}

/**
 * Unregister current device from push notifications.
 */
export async function unregisterCurrentDevice(): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current token
    const token = await getFCMToken()

    if (token) {
      // Unregister from backend
      await unregisterPushSubscriptionByToken(token)

      // Delete FCM token
      await deleteFCMToken()
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao desativar.' }
  }
}
