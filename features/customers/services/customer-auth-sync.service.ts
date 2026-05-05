"use server"

/**
 * Customer Auth Sync Service — Pure server-side helper
 * 
 * Ensures a customer record exists for a given auth user.
 * Used by both customer-auth.actions.ts and agenda.actions.ts
 * to avoid circular dependencies.
 * 
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 * NEVER expose the admin client on the client side.
 * 
 * CONTRACT:
 * - Idempotent: safe to call multiple times
 * - Self-healing: fetches auth user data when optionalData is incomplete
 * - Never returns success=true with customerId=null
 * - Never overwrites good data with empty
 * - Never creates duplicates
 */

import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type EnsureCustomerCode =
  | 'OK'
  | 'CONFLICT_EMAIL'
  | 'CONFLICT_PHONE'
  | 'INSERT_FAILED'
  | 'UPDATE_FAILED'
  | 'AUTH_USER_NOT_FOUND'
  | 'LOOKUP_FAILED'
  | 'UNEXPECTED_ERROR'

export interface EnsureCustomerResult {
  success: boolean
  customerId: string | null
  fullName: string | null
  email: string | null
  phone: string | null
  avatarUrl: string | null
  loyaltyPoints: number | null
  error?: string
  code: EnsureCustomerCode
}

/**
 * Ensure a customer record exists for the given auth user.
 * Idempotent — safe to call multiple times.
 * 
 * If optionalData is incomplete (missing email), fetches auth user from
 * Supabase admin API to get complete data.
 * 
 * Search order:
 *   1. auth_user_id
 *   2. email (normalized)
 *   3. phone (normalized)
 * 
 * If found without auth_user_id → link it.
 * If found with DIFFERENT auth_user_id → block (don't overwrite).
 * If not found → create new.
 * Never duplicates. Never overwrites good data with empty.
 */
export async function ensureCustomerForAuthUser(
  authUserId: string,
  optionalData?: { email?: string; fullName?: string; phone?: string }
): Promise<EnsureCustomerResult> {
  const empty: EnsureCustomerResult = {
    success: false,
    customerId: null, fullName: null, email: null, phone: null,
    avatarUrl: null, loyaltyPoints: null,
    code: 'UNEXPECTED_ERROR',
  }

  if (!authUserId) {
    console.error("[CustomerSync] ensureCustomerForAuthUser called without authUserId")
    return { ...empty, error: "ID de autenticação ausente.", code: 'AUTH_USER_NOT_FOUND' }
  }

  try {
    const adminClient = getAdminClient()

    // ── Step 0: Resolve complete user data ──
    // If optionalData is incomplete (no email), fetch from auth.users via admin API
    let email = optionalData?.email?.trim().toLowerCase() || null
    let fullName = optionalData?.fullName || null
    let phone = optionalData?.phone || null

    if (!email) {
      console.log(`[CustomerSync] optionalData missing email for ${authUserId}, fetching from auth.users`)
      const { data: authUserData, error: authErr } = await adminClient.auth.admin.getUserById(authUserId)

      if (authErr || !authUserData?.user) {
        console.error(`[CustomerSync] Failed to fetch auth user ${authUserId}:`, authErr?.message || 'no user data')
        return {
          ...empty,
          error: "Usuário de autenticação não encontrado.",
          code: 'AUTH_USER_NOT_FOUND',
        }
      }

      const authUser = authUserData.user
      email = authUser.email?.trim().toLowerCase() || null
      fullName = fullName || authUser.user_metadata?.full_name || authUser.user_metadata?.name || null
      phone = phone || authUser.user_metadata?.phone || null
    } else {
      email = email.trim().toLowerCase()
    }

    // Normalize phone (digits only, min 10)
    const normalizedPhone = phone?.replace(/\D/g, '') || null
    const validPhone = normalizedPhone && normalizedPhone.length >= 10 ? normalizedPhone : null

    console.log(`[CustomerSync] Resolving customer for auth=${authUserId}, email=${email}, phone=${validPhone ? '***' + validPhone.slice(-4) : 'none'}`)

    // ── Step 1: Lookup by auth_user_id ──
    const { data: existing, error: lookupErr } = await adminClient
      .from("customers")
      .select("id, full_name, email, phone, mobile_phone, avatar_url, loyalty_points")
      .eq("auth_user_id", authUserId)
      .maybeSingle() as { data: any; error: any }

    if (lookupErr) {
      console.error(`[CustomerSync] Step 1 — Lookup by auth_user_id failed:`, {
        authUserId,
        errorCode: lookupErr.code,
        errorMessage: lookupErr.message,
      })
      return { ...empty, error: "Erro ao buscar registro de cliente. Tente novamente.", code: 'LOOKUP_FAILED' }
    }

    if (existing) {
      // Update last_login_at only
      await adminClient
        .from("customers")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", existing.id)

      console.log(`[CustomerSync] Step 1 — Found existing customer ${existing.id} by auth_user_id`)
      return {
        success: true,
        customerId: existing.id,
        fullName: existing.full_name,
        email: existing.email,
        phone: existing.mobile_phone || existing.phone,
        avatarUrl: existing.avatar_url || null,
        loyaltyPoints: existing.loyalty_points ?? null,
        code: 'OK',
      }
    }

    // ── Step 2: Lookup by email (normalized) ──
    if (email) {
      const { data: byEmail, error: emailErr } = await adminClient
        .from("customers")
        .select("id, auth_user_id, full_name, email, phone, mobile_phone, avatar_url, loyalty_points")
        .eq("email", email)
        .maybeSingle() as { data: any; error: any }

      if (emailErr) {
        console.error(`[CustomerSync] Step 2 — Lookup by email failed:`, {
          authUserId, email,
          errorCode: emailErr.code,
          errorMessage: emailErr.message,
        })
        // Don't return error yet — try phone or create
      }

      if (byEmail) {
        // Already linked to a DIFFERENT auth user → CONFLICT
        if (byEmail.auth_user_id && byEmail.auth_user_id !== authUserId) {
          console.warn(`[CustomerSync] Step 2 — CONFLICT: Customer ${byEmail.id} email=${email} linked to auth=${byEmail.auth_user_id}, requesting auth=${authUserId}`)
          return {
            ...empty,
            error: "Este e-mail já está vinculado a outra conta. Entre com a conta correta ou fale com a barbearia.",
            code: 'CONFLICT_EMAIL',
          }
        }

        // Link unlinked customer (or update if same auth_user_id)
        const updates: Record<string, any> = {
          last_login_at: new Date().toISOString(),
        }
        if (!byEmail.auth_user_id) {
          updates.auth_user_id = authUserId
        }
        // Only update name/phone if currently empty and we have data
        if (!byEmail.full_name && fullName) {
          updates.full_name = fullName
          updates.normalized_name = fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        }
        if (!byEmail.mobile_phone && validPhone) {
          updates.mobile_phone = validPhone
        }

        const { error: updateErr } = await adminClient.from("customers").update(updates).eq("id", byEmail.id)
        if (updateErr) {
          console.error(`[CustomerSync] Step 2 — Update customer ${byEmail.id} failed:`, {
            authUserId, email,
            errorCode: updateErr.code,
            errorMessage: updateErr.message,
          })
          return { ...empty, error: "Erro ao vincular cliente. Tente novamente.", code: 'UPDATE_FAILED' }
        }

        console.log(`[CustomerSync] Step 2 — Linked customer ${byEmail.id} by email=${email}`)
        return {
          success: true,
          customerId: byEmail.id,
          fullName: byEmail.full_name || fullName || null,
          email: byEmail.email || email,
          phone: byEmail.mobile_phone || byEmail.phone || validPhone || null,
          avatarUrl: byEmail.avatar_url || null,
          loyaltyPoints: byEmail.loyalty_points ?? null,
          code: 'OK',
        }
      }
    }

    // ── Step 3: Lookup by phone (normalized) ──
    if (validPhone) {
      const { data: byPhone, error: phoneErr } = await adminClient
        .from("customers")
        .select("id, auth_user_id, full_name, email, phone, mobile_phone, avatar_url, loyalty_points")
        .eq("mobile_phone", validPhone)
        .maybeSingle() as { data: any; error: any }

      if (phoneErr) {
        console.error(`[CustomerSync] Step 3 — Lookup by phone failed:`, {
          authUserId,
          errorCode: phoneErr.code,
          errorMessage: phoneErr.message,
        })
      }

      if (byPhone) {
        // Already linked to a DIFFERENT auth user → CONFLICT
        if (byPhone.auth_user_id && byPhone.auth_user_id !== authUserId) {
          console.warn(`[CustomerSync] Step 3 — CONFLICT: Customer ${byPhone.id} phone linked to auth=${byPhone.auth_user_id}, requesting auth=${authUserId}`)
          return {
            ...empty,
            error: "Este telefone já está vinculado a outra conta. Entre com a conta correta ou fale com a barbearia.",
            code: 'CONFLICT_PHONE',
          }
        }

        // Link unlinked customer
        const updates: Record<string, any> = {
          auth_user_id: authUserId,
          last_login_at: new Date().toISOString(),
        }
        if (email && !byPhone.email) {
          updates.email = email
        }
        if (!byPhone.full_name && fullName) {
          updates.full_name = fullName
          updates.normalized_name = fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        }

        const { error: updateErr } = await adminClient.from("customers").update(updates).eq("id", byPhone.id)
        if (updateErr) {
          console.error(`[CustomerSync] Step 3 — Update customer ${byPhone.id} failed:`, {
            authUserId,
            errorCode: updateErr.code,
            errorMessage: updateErr.message,
          })
          return { ...empty, error: "Erro ao vincular cliente pelo telefone. Tente novamente.", code: 'UPDATE_FAILED' }
        }

        console.log(`[CustomerSync] Step 3 — Linked customer ${byPhone.id} by phone`)
        return {
          success: true,
          customerId: byPhone.id,
          fullName: byPhone.full_name || fullName || null,
          email: byPhone.email || email || null,
          phone: byPhone.mobile_phone || byPhone.phone || null,
          avatarUrl: byPhone.avatar_url || null,
          loyaltyPoints: byPhone.loyalty_points ?? null,
          code: 'OK',
        }
      }
    }

    // ── Step 4: Create new customer ──
    const resolvedName = fullName || (email ? email.split('@')[0] : 'Cliente')
    const normalizedName = resolvedName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    const { data: newCustomer, error: insertErr } = await adminClient
      .from("customers")
      .insert({
        auth_user_id: authUserId,
        full_name: resolvedName,
        normalized_name: normalizedName,
        email: email || null,
        mobile_phone: validPhone || null,
        is_active: true,
        last_login_at: new Date().toISOString(),
      })
      .select("id, full_name, email, mobile_phone, avatar_url, loyalty_points")
      .single() as { data: any; error: any }

    if (insertErr) {
      console.error(`[CustomerSync] Step 4 — Insert new customer failed:`, {
        authUserId, email,
        errorCode: insertErr.code,
        errorMessage: insertErr.message,
        hint: insertErr.hint,
      })

      // Check for unique constraint violation (23505) — likely duplicate email
      if (insertErr.code === '23505') {
        // This means a customer with same email or auth_user_id was just created (race condition)
        // Retry lookup by auth_user_id
        const { data: retryExisting } = await adminClient
          .from("customers")
          .select("id, full_name, email, phone, mobile_phone, avatar_url, loyalty_points")
          .eq("auth_user_id", authUserId)
          .maybeSingle() as { data: any }

        if (retryExisting) {
          console.log(`[CustomerSync] Step 4 — Race condition resolved: found customer ${retryExisting.id} on retry`)
          return {
            success: true,
            customerId: retryExisting.id,
            fullName: retryExisting.full_name,
            email: retryExisting.email,
            phone: retryExisting.mobile_phone || retryExisting.phone,
            avatarUrl: retryExisting.avatar_url || null,
            loyaltyPoints: retryExisting.loyalty_points ?? null,
            code: 'OK',
          }
        }
      }

      return { ...empty, error: "Não foi possível criar registro de cliente. Tente novamente.", code: 'INSERT_FAILED' }
    }

    console.log(`[CustomerSync] Step 4 — Created new customer ${newCustomer?.id} for auth=${authUserId}, email=${email}`)
    return {
      success: true,
      customerId: newCustomer?.id || null,
      fullName: newCustomer?.full_name || resolvedName,
      email: newCustomer?.email || email || null,
      phone: newCustomer?.mobile_phone || validPhone || null,
      avatarUrl: newCustomer?.avatar_url || null,
      loyaltyPoints: newCustomer?.loyalty_points ?? null,
      code: newCustomer?.id ? 'OK' : 'INSERT_FAILED',
    }
  } catch (err: any) {
    console.error(`[CustomerSync] Unexpected error for auth=${authUserId}:`, err?.message || err)
    return { ...empty, error: "Erro inesperado ao sincronizar cliente.", code: 'UNEXPECTED_ERROR' }
  }
}
