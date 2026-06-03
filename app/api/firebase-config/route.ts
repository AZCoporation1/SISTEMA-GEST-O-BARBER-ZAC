// ── Firebase Config API Route ───────────────────────────────
// Barber Zac ERP — Returns public Firebase config for service worker
// Only NEXT_PUBLIC_ values — NO secrets exposed
// The SW fetches this on activation to initialize Firebase

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  })
}
