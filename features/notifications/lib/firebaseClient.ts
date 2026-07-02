// ── Firebase Client SDK (Browser only) ──────────────────────
// Barber Zac ERP — Lazy initialization for obtaining FCM token
// Uses NEXT_PUBLIC_ env vars only (safe for client)

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getMessaging, getToken, deleteToken, type Messaging } from 'firebase/messaging'

let firebaseApp: FirebaseApp | null = null
let messagingInstance: Messaging | null = null

/**
 * Check if Firebase client config is available.
 */
export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  )
}

/**
 * Get or initialize Firebase app (singleton).
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (firebaseApp) return firebaseApp

  if (!isFirebaseConfigured()) {
    console.warn('[Firebase] Client config not available (NEXT_PUBLIC_FIREBASE_* env vars missing)')
    return null
  }

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }

  const existing = getApps()
  firebaseApp = existing.length > 0 ? existing[0] : initializeApp(config)
  return firebaseApp
}

/**
 * Get Firebase Messaging instance.
 */
function getMessagingInstance(): Messaging | null {
  if (messagingInstance) return messagingInstance

  const app = getFirebaseApp()
  if (!app) return null

  try {
    messagingInstance = getMessaging(app)
    return messagingInstance
  } catch (err) {
    console.warn('[Firebase] Failed to get messaging instance:', err)
    return null
  }
}

/**
 * Get FCM token for current browser/device.
 * Requires notification permission to be already granted.
 */
export async function getFCMToken(): Promise<string | null> {
  const messaging = getMessagingInstance()
  if (!messaging) return null

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    console.warn('[Firebase] VAPID key not configured (NEXT_PUBLIC_FIREBASE_VAPID_KEY)')
    return null
  }

  try {
    // Use the unified SW (which includes both Workbox + FCM)
    // Try to get existing registration first, register only if needed
    let swReg = await navigator.serviceWorker.getRegistration('/')
    if (!swReg) {
      swReg = await navigator.serviceWorker.register('/sw.js')
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    })

    return token || null
  } catch (err) {
    console.error('[Firebase] Failed to get FCM token:', err)
    return null
  }
}

/**
 * Delete the current FCM token (unregister device).
 */
export async function deleteFCMToken(): Promise<boolean> {
  const messaging = getMessagingInstance()
  if (!messaging) return false

  try {
    await deleteToken(messaging)
    return true
  } catch (err) {
    console.error('[Firebase] Failed to delete token:', err)
    return false
  }
}
