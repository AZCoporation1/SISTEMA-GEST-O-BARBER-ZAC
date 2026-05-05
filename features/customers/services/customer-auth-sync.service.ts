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
 */

import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface EnsureCustomerResult {
  customerId: string | null
  fullName: string | null
  email: string | null
  phone: string | null
  avatarUrl: string | null
  loyaltyPoints: number | null
  error?: string
}

/**
 * Ensure a customer record exists for the given auth user.
 * Idempotent — safe to call multiple times.
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
    customerId: null, fullName: null, email: null, phone: null,
    avatarUrl: null, loyaltyPoints: null,
  }

  if (!authUserId) {
    console.error("[CustomerSync] ensureCustomerForAuthUser called without authUserId")
    return { ...empty, error: "ID de autenticação ausente." }
  }

  try {
    const adminClient = getAdminClient()

    // 1. Look up by auth_user_id
    const { data: existing, error: lookupErr } = await adminClient
      .from("customers")
      .select("id, full_name, email, phone, mobile_phone, avatar_url, loyalty_points")
      .eq("auth_user_id", authUserId)
      .maybeSingle() as { data: any; error: any }

    if (lookupErr) {
      console.error("[CustomerSync] Lookup by auth_user_id failed:", lookupErr)
      return { ...empty, error: "Erro ao buscar registro de cliente." }
    }

    if (existing) {
      // Update last_login_at only
      await adminClient
        .from("customers")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", existing.id)
      return {
        customerId: existing.id,
        fullName: existing.full_name,
        email: existing.email,
        phone: existing.mobile_phone || existing.phone,
        avatarUrl: existing.avatar_url || null,
        loyaltyPoints: existing.loyalty_points ?? null,
      }
    }

    // 2. Look up by email (normalized)
    if (optionalData?.email) {
      const normalizedEmail = optionalData.email.trim().toLowerCase()
      const { data: byEmail, error: emailErr } = await adminClient
        .from("customers")
        .select("id, auth_user_id, full_name, email, phone, mobile_phone, avatar_url, loyalty_points")
        .eq("email", normalizedEmail)
        .maybeSingle() as { data: any; error: any }

      if (emailErr) {
        console.error("[CustomerSync] Lookup by email failed:", emailErr)
      }

      if (byEmail) {
        // Already linked to a DIFFERENT auth user → block
        if (byEmail.auth_user_id && byEmail.auth_user_id !== authUserId) {
          console.warn(`[CustomerSync] Customer ${byEmail.id} already linked to different auth user ${byEmail.auth_user_id}`)
          return {
            ...empty,
            error: "Este e-mail já está vinculado a outra conta. Entre com a conta correta ou fale com a barbearia.",
          }
        }

        // Link unlinked customer
        const updates: Record<string, any> = {
          last_login_at: new Date().toISOString(),
        }
        if (!byEmail.auth_user_id) {
          updates.auth_user_id = authUserId
        }
        // Only update name/phone if currently empty and we have data
        if (!byEmail.full_name && optionalData.fullName) {
          updates.full_name = optionalData.fullName
          updates.normalized_name = optionalData.fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        }
        if (!byEmail.mobile_phone && optionalData.phone) {
          updates.mobile_phone = optionalData.phone.replace(/\D/g, '')
        }
        
        await adminClient.from("customers").update(updates).eq("id", byEmail.id)
        return {
          customerId: byEmail.id,
          fullName: byEmail.full_name || optionalData.fullName || null,
          email: byEmail.email || normalizedEmail,
          phone: byEmail.mobile_phone || byEmail.phone || optionalData.phone || null,
          avatarUrl: byEmail.avatar_url || null,
          loyaltyPoints: byEmail.loyalty_points ?? null,
        }
      }
    }

    // 3. Look up by phone (normalized)
    if (optionalData?.phone) {
      const normalizedPhone = optionalData.phone.replace(/\D/g, '')
      if (normalizedPhone.length >= 10) {
        const { data: byPhone, error: phoneErr } = await adminClient
          .from("customers")
          .select("id, auth_user_id, full_name, email, phone, mobile_phone, avatar_url, loyalty_points")
          .eq("mobile_phone", normalizedPhone)
          .maybeSingle() as { data: any; error: any }

        if (phoneErr) {
          console.error("[CustomerSync] Lookup by phone failed:", phoneErr)
        }

        if (byPhone) {
          // Already linked to a DIFFERENT auth user → block
          if (byPhone.auth_user_id && byPhone.auth_user_id !== authUserId) {
            console.warn(`[CustomerSync] Customer ${byPhone.id} already linked to different auth user ${byPhone.auth_user_id}`)
            return {
              ...empty,
              error: "Este telefone já está vinculado a outra conta. Entre com a conta correta ou fale com a barbearia.",
            }
          }

          // Link unlinked customer
          const updates: Record<string, any> = {
            auth_user_id: authUserId,
            last_login_at: new Date().toISOString(),
          }
          if (optionalData.email) {
            updates.email = optionalData.email.trim().toLowerCase()
          }
          if (!byPhone.full_name && optionalData.fullName) {
            updates.full_name = optionalData.fullName
            updates.normalized_name = optionalData.fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          }

          await adminClient.from("customers").update(updates).eq("id", byPhone.id)
          return {
            customerId: byPhone.id,
            fullName: byPhone.full_name || optionalData.fullName || null,
            email: byPhone.email || optionalData.email || null,
            phone: byPhone.mobile_phone || byPhone.phone || null,
            avatarUrl: byPhone.avatar_url || null,
            loyaltyPoints: byPhone.loyalty_points ?? null,
          }
        }
      }
    }

    // 4. Create new customer
    const normalizedEmail = optionalData?.email?.trim().toLowerCase()
    const normalizedPhone = optionalData?.phone?.replace(/\D/g, '')
    const fullName = optionalData?.fullName || 'Cliente'
    const normalizedName = fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    const { data: newCustomer, error: insertErr } = await adminClient
      .from("customers")
      .insert({
        auth_user_id: authUserId,
        full_name: fullName,
        normalized_name: normalizedName,
        email: normalizedEmail || null,
        mobile_phone: normalizedPhone || null,
        is_active: true,
        last_login_at: new Date().toISOString(),
      })
      .select("id, full_name, email, mobile_phone, avatar_url, loyalty_points")
      .single() as { data: any; error: any }

    if (insertErr) {
      console.error("[CustomerSync] Insert new customer failed:", insertErr)
      return { ...empty, error: "Não foi possível criar registro de cliente. Tente novamente." }
    }

    console.log(`[CustomerSync] Created new customer ${newCustomer?.id} for auth user ${authUserId}`)
    return {
      customerId: newCustomer?.id || null,
      fullName: newCustomer?.full_name || fullName,
      email: newCustomer?.email || normalizedEmail || null,
      phone: newCustomer?.mobile_phone || normalizedPhone || null,
      avatarUrl: newCustomer?.avatar_url || null,
      loyaltyPoints: newCustomer?.loyalty_points ?? null,
    }
  } catch (err: any) {
    console.error("[CustomerSync] Unexpected error:", err?.message || err)
    return { ...empty, error: "Erro inesperado ao sincronizar cliente." }
  }
}
