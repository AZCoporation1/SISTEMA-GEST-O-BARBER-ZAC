// ── FCM Diagnostics API Route ───────────────────────────────
// Barber Zac ERP — Temporary diagnostics endpoint for FCM config
// DELETE THIS FILE after debugging is complete

import { NextResponse } from 'next/server'

export async function GET() {
  const fcmEnabled = process.env.FCM_ENABLED
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  const diagnostics = {
    fcmEnabled,
    fcmEnabledIsTrue: fcmEnabled === 'true',
    hasProjectId: !!projectId,
    projectId: projectId || '(not set)',
    hasClientEmail: !!clientEmail,
    clientEmail: clientEmail ? clientEmail.substring(0, 20) + '...' : '(not set)',
    hasPrivateKey: !!privateKey,
    privateKeyLength: privateKey?.length || 0,
    privateKeyStartsWith: privateKey?.substring(0, 30) || '(not set)',
    privateKeyContainsNewline: privateKey?.includes('\n') || false,
    privateKeyContainsLiteralBackslashN: privateKey?.includes('\\n') || false,
    privateKeyEndsCorrectly: privateKey?.trimEnd().endsWith('-----END PRIVATE KEY-----') || privateKey?.trimEnd().endsWith('-----END PRIVATE KEY-----\n') || false,
  }

  // Try to actually initialize Firebase Admin
  let initResult = 'not attempted'
  try {
    const processedKey = privateKey?.replace(/\\n/g, '\n')
    
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin')
    
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: processedKey,
        }),
      })
    }
    
    // Try a dry-run send to validate credentials
    const messaging = admin.messaging()
    initResult = 'Firebase Admin initialized successfully'
    
    // Test with dummy token to verify credentials work
    try {
      await messaging.send(
        { token: 'test-invalid-token', notification: { title: 'diag' } },
        true // dryRun
      )
      initResult += ' | dry-run succeeded (unexpected)'
    } catch (sendErr: any) {
      const code = sendErr?.code || sendErr?.errorInfo?.code || ''
      if (code.includes('invalid') || code.includes('not-registered')) {
        initResult += ' | credentials valid (token invalid as expected)'
      } else {
        initResult += ` | send error: ${code} - ${sendErr?.message || sendErr}`
      }
    }
  } catch (err: any) {
    initResult = `INIT FAILED: ${err?.message || err}`
  }

  return NextResponse.json({
    ...diagnostics,
    initResult,
    timestamp: new Date().toISOString(),
  })
}
