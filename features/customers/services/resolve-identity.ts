"use server"

/**
 * Customer Area Identity Resolver
 * 
 * Central source of truth for determining a user's identity
 * in the customer portal context.
 * 
 * RULE: No user_profile AND no customer = needs_customer_sync (NEVER professional)
 * RULE: Only internal_only if user_profile EXISTS with a real system_role
 * RULE: Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS
 */

import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type IdentityStatus =
  | 'customer'            // has customer, can use customer area
  | 'needs_customer_sync' // no user_profile, no customer — must create customer
  | 'internal_only'       // has user_profile, no customer — real internal user
  | 'dual_identity'       // has user_profile AND customer
  | 'conflict'            // email/phone belongs to different auth_user_id

export interface CustomerAreaIdentity {
  authUserId: string
  email: string | null
  hasUserProfile: boolean
  userProfileId: string | null
  systemRole: string | null
  hasCustomer: boolean
  customerId: string | null
  canAccessERP: boolean
  erpRedirectPath: string | null
  status: IdentityStatus
  reason: string
}

/**
 * Resolve identity for the customer area.
 * 
 * @param authUserId - The Supabase auth user ID
 * @param email - Optional email (from session)
 */
export async function resolveCustomerAreaIdentity(
  authUserId: string,
  email?: string | null
): Promise<CustomerAreaIdentity> {
  const empty: CustomerAreaIdentity = {
    authUserId,
    email: email || null,
    hasUserProfile: false,
    userProfileId: null,
    systemRole: null,
    hasCustomer: false,
    customerId: null,
    canAccessERP: false,
    erpRedirectPath: null,
    status: 'needs_customer_sync',
    reason: '',
  }

  if (!authUserId) {
    return { ...empty, reason: 'authUserId ausente' }
  }

  try {
    const adminClient = getAdminClient()

    // 1. Check user_profiles (internal ERP user)
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('id, system_role')
      .eq('auth_user_id', authUserId)
      .maybeSingle() as { data: any }

    const hasUserProfile = !!profile?.system_role
    const systemRole = profile?.system_role || null
    const userProfileId = profile?.id || null

    // Determine ERP access and redirect path
    let canAccessERP = false
    let erpRedirectPath: string | null = null
    if (hasUserProfile && systemRole) {
      canAccessERP = true
      if (systemRole === 'professional') {
        erpRedirectPath = '/profissional'
      } else {
        // admin_total, owner_admin_professional
        erpRedirectPath = '/dashboard'
      }
    }

    // 2. Check customers table
    const { data: customer } = await adminClient
      .from('customers')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle() as { data: any }

    const hasCustomer = !!customer?.id
    const customerId = customer?.id || null

    // 3. Determine status
    if (hasUserProfile && hasCustomer) {
      return {
        ...empty,
        hasUserProfile,
        userProfileId,
        systemRole,
        hasCustomer,
        customerId,
        canAccessERP,
        erpRedirectPath,
        status: 'dual_identity',
        reason: 'Conta interna com perfil de cliente vinculado',
      }
    }

    if (hasUserProfile && !hasCustomer) {
      return {
        ...empty,
        hasUserProfile,
        userProfileId,
        systemRole,
        hasCustomer: false,
        customerId: null,
        canAccessERP,
        erpRedirectPath,
        status: 'internal_only',
        reason: `Conta interna (${systemRole}) sem perfil de cliente`,
      }
    }

    if (!hasUserProfile && hasCustomer) {
      return {
        ...empty,
        hasUserProfile: false,
        userProfileId: null,
        systemRole: null,
        hasCustomer,
        customerId,
        canAccessERP: false,
        erpRedirectPath: null,
        status: 'customer',
        reason: 'Cliente com customer vinculado',
      }
    }

    // !hasUserProfile && !hasCustomer
    // This is the CRITICAL case: a new user who has never been in the system.
    // They are NOT a professional. They are NOT internal.
    // They need a customer record created.
    return {
      ...empty,
      hasUserProfile: false,
      userProfileId: null,
      systemRole: null,
      hasCustomer: false,
      customerId: null,
      canAccessERP: false,
      erpRedirectPath: null,
      status: 'needs_customer_sync',
      reason: 'Conta nova sem user_profile nem customer — deve criar customer',
    }
  } catch (err: any) {
    console.error('[ResolveIdentity] Error:', err?.message || err)
    return { ...empty, reason: `Erro ao resolver identidade: ${err?.message}` }
  }
}
