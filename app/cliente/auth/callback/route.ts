import { createServerClient } from '@/lib/supabase/server'
import { ensureCustomerForAuthUser } from '@/features/customers/services/customer-auth-sync.service'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const rawCallback = requestUrl.searchParams.get('callbackUrl') || '/cliente/perfil'
  
  // Validate callbackUrl — only /cliente/* paths allowed
  const callbackUrl = rawCallback.startsWith('/cliente') ? rawCallback : '/cliente/perfil'

  if (code) {
    const supabase = await createServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // ALWAYS create/sync customer on OAuth callback
      // Regardless of whether user_profiles exists or not.
      // The customer area should ALWAYS serve users as customers.
      const ensureResult = await ensureCustomerForAuthUser(data.user.id, {
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
        phone: data.user.user_metadata?.phone,
      })

      if (!ensureResult.success) {
        console.error(`[AuthCallback] ensureCustomerForAuthUser failed for ${data.user.id}:`, ensureResult.error, 'code:', ensureResult.code)
      } else {
        console.log(`[AuthCallback] Customer ensured: ${ensureResult.customerId} for auth=${data.user.id}`)
      }
    }
  }

  // Redirect to callback URL
  return NextResponse.redirect(new URL(callbackUrl, requestUrl.origin))
}
