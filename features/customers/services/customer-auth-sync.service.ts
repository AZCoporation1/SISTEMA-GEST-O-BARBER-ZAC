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
  phone: string | null
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
 * If not found → create new.
 * Never duplicates. Never overwrites good data with empty.
 */
export async function ensureCustomerForAuthUser(
  authUserId: string,
  optionalData?: { email?: string; fullName?: string; phone?: string }
): Promise<EnsureCustomerResult> {
  try {
    const adminClient = getAdminClient()

    // 1. Look up by auth_user_id
    const { data: existing } = await adminClient
      .from("customers")
      .select("id, full_name, phone, mobile_phone")
      .eq("auth_user_id", authUserId)
      .maybeSingle() as { data: any }

    if (existing) {
      // Update last_login_at only
      await adminClient
        .from("customers")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", existing.id)
      return {
        customerId: existing.id,
        fullName: existing.full_name,
        phone: existing.mobile_phone || existing.phone,
      }
    }

    // 2. Look up by email (normalized)
    if (optionalData?.email) {
      const normalizedEmail = optionalData.email.trim().toLowerCase()
      const { data: byEmail } = await adminClient
        .from("customers")
        .select("id, auth_user_id, full_name, phone, mobile_phone")
        .eq("email", normalizedEmail)
        .maybeSingle() as { data: any }

      if (byEmail) {
        // Link unlinked customer — don't overwrite if already linked to someone else
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
          phone: byEmail.mobile_phone || byEmail.phone || optionalData.phone || null,
        }
      }
    }

    // 3. Look up by phone (normalized)
    if (optionalData?.phone) {
      const normalizedPhone = optionalData.phone.replace(/\D/g, '')
      if (normalizedPhone.length >= 10) {
        const { data: byPhone } = await adminClient
          .from("customers")
          .select("id, auth_user_id, full_name, phone, mobile_phone")
          .eq("mobile_phone", normalizedPhone)
          .maybeSingle() as { data: any }

        if (byPhone && !byPhone.auth_user_id) {
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
            phone: byPhone.mobile_phone || byPhone.phone || null,
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
      .select("id, full_name, mobile_phone")
      .single() as { data: any; error: any }

    if (insertErr) {
      console.error("ensureCustomerForAuthUser insert error:", insertErr)
      return { customerId: null, fullName: null, phone: null }
    }

    return {
      customerId: newCustomer?.id || null,
      fullName: newCustomer?.full_name || fullName,
      phone: newCustomer?.mobile_phone || normalizedPhone || null,
    }
  } catch (err: any) {
    console.error("ensureCustomerForAuthUser error:", err)
    return { customerId: null, fullName: null, phone: null }
  }
}
