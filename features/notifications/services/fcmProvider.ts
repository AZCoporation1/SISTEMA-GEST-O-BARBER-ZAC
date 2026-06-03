// ── FCM Push Provider ───────────────────────────────────────
// Barber Zac ERP — Firebase Cloud Messaging implementation
// Server-side only — uses firebase-admin SDK
// Imported lazily by pushProvider.ts

import type { PushProvider } from './pushProvider'
import type { PushPayload, SendResult } from '../types'

let adminApp: any = null

/**
 * Initialize Firebase Admin SDK (singleton).
 * Uses server-only env vars — NEVER NEXT_PUBLIC.
 */
function getFirebaseAdmin() {
  if (adminApp) return adminApp

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin SDK not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
    )
  }

  // Lazy import to avoid bundling firebase-admin in client
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require('firebase-admin')

  if (admin.apps.length === 0) {
    adminApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })
  } else {
    adminApp = admin.apps[0]
  }

  return adminApp
}

export class FCMPushProvider implements PushProvider {
  readonly name = 'fcm'

  async sendToToken(token: string, payload: PushPayload): Promise<SendResult> {
    try {
      const admin = getFirebaseAdmin()
      const messaging = admin.messaging()

      // Firebase Admin SDK requires all data values to be strings
      const stringData: Record<string, string> = {}
      if (payload.data) {
        for (const [key, value] of Object.entries(payload.data)) {
          stringData[key] = typeof value === 'string' ? value : JSON.stringify(value)
        }
      }

      // Include title/body in data so the SW can display them
      stringData.title = payload.title
      stringData.body = payload.body
      if (payload.icon) stringData.icon = payload.icon

      // Use data-only message (no top-level `notification`) to ensure
      // onBackgroundMessage always fires in the SW across all browsers.
      // The SW handles showNotification() from the data fields.
      const message = {
        token,
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/icons/ibz-192.png',
            badge: payload.badge || '/icons/ibz-192.png',
            tag: payload.tag || 'barber-zac',
            renotify: true,
            requireInteraction: false,
          },
          fcmOptions: {
            link: stringData.url || '/',
          },
          data: stringData,
        },
        data: stringData,
      }

      const response = await messaging.send(message)

      return {
        status: 'sent',
        providerMessageId: response,
      }
    } catch (err: any) {
      const errorCode = err?.code || err?.errorInfo?.code || ''
      const errorMsg = err?.message || err?.errorInfo?.message || 'Unknown FCM error'

      console.error('[FCM] Send error:', errorCode, errorMsg)

      // Token is invalid/expired — should be deactivated
      const invalidTokenCodes = [
        'messaging/invalid-registration-token',
        'messaging/registration-token-not-registered',
        'messaging/invalid-argument',
      ]

      if (invalidTokenCodes.includes(errorCode)) {
        return {
          status: 'failed',
          error: `Invalid token: ${errorCode}`,
        }
      }

      return {
        status: 'failed',
        error: `${errorCode}: ${errorMsg}`,
      }
    }
  }

  async sendToMultiple(tokens: string[], payload: PushPayload): Promise<SendResult[]> {
    // Send individually to track per-token results
    return Promise.all(tokens.map(token => this.sendToToken(token, payload)))
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      // Send a dry-run message to validate
      const admin = getFirebaseAdmin()
      const messaging = admin.messaging()

      await messaging.send(
        { token, notification: { title: 'validate' } },
        true // dryRun
      )
      return true
    } catch {
      return false
    }
  }
}
