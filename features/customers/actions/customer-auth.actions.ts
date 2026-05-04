"use server"

/**
 * Customer Auth Actions — Cadastro e Login do Cliente
 * Uses SUPABASE_SERVICE_ROLE_KEY server-side to bypass RLS for customer management.
 * This is the same pattern used in public-booking.actions.ts and inventory.actions.ts.
 */

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const customerSignUpSchema = z.object({
  fullName: z.string().min(2, "Nome completo é obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
  phone: z.string().min(10, "Telefone inválido"),
})

const customerLoginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
})

export async function customerSignUp(data: z.infer<typeof customerSignUpSchema>) {
  try {
    const validated = customerSignUpSchema.parse(data)
    const adminClient = getAdminClient()

    const normalizedEmail = validated.email.trim().toLowerCase()
    const normalizedPhone = validated.phone.replace(/\D/g, '')
    const normalizedName = validated.fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    // 1. Create Auth user via admin API (bypasses email confirmation)
    const { data: authData, error: signUpError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: validated.password,
      email_confirm: true,  // Auto-confirm email — no verification needed
      user_metadata: {
        full_name: validated.fullName,
        phone: normalizedPhone,
        user_type: "customer",
      },
    })

    if (signUpError) {
      console.error("customerSignUp auth error:", signUpError)
      // Handle "user already exists"
      if (signUpError.message?.includes("already been registered") || 
          signUpError.message?.includes("already exists") ||
          signUpError.message?.includes("unique") ||
          signUpError.status === 422) {
        return { success: false, error: "Este e-mail já está cadastrado. Faça login." }
      }
      return { success: false, error: "Não foi possível criar a conta. Tente novamente." }
    }

    const authUserId = authData.user?.id
    if (!authUserId) {
      return { success: false, error: "Falha ao criar usuário. Tente novamente." }
    }

    // 2. Check if a customer already exists with this email or phone (deduplication)
    const { data: existingByAuth } = await adminClient
      .from("customers")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle()

    if (existingByAuth) {
      // Already linked — just update
      await adminClient
        .from("customers")
        .update({ 
          full_name: validated.fullName,
          normalized_name: normalizedName,
          mobile_phone: normalizedPhone,
          is_active: true,
          last_login_at: new Date().toISOString()
        })
        .eq("id", existingByAuth.id)
    } else {
      // Check by email
      const { data: existingByEmail } = await adminClient
        .from("customers")
        .select("id, auth_user_id")
        .eq("email", normalizedEmail)
        .maybeSingle()

      if (existingByEmail) {
        // Link existing customer to new auth user
        await adminClient
          .from("customers")
          .update({ 
            auth_user_id: authUserId,
            mobile_phone: existingByEmail.auth_user_id ? undefined : normalizedPhone, // Don't overwrite if already linked
            is_active: true,
            last_login_at: new Date().toISOString()
          })
          .eq("id", existingByEmail.id)
      } else {
        // Check by phone
        const { data: existingByPhone } = await adminClient
          .from("customers")
          .select("id, auth_user_id")
          .eq("mobile_phone", normalizedPhone)
          .maybeSingle()

        if (existingByPhone && !existingByPhone.auth_user_id) {
          // Link existing unlinked customer to new auth user
          await adminClient
            .from("customers")
            .update({ 
              auth_user_id: authUserId,
              email: normalizedEmail,
              is_active: true,
              last_login_at: new Date().toISOString()
            })
            .eq("id", existingByPhone.id)
        } else {
          // Create brand new customer
          const { error: insertError } = await adminClient
            .from("customers")
            .insert({
              auth_user_id: authUserId,
              full_name: validated.fullName,
              normalized_name: normalizedName,
              email: normalizedEmail,
              mobile_phone: normalizedPhone,
              is_active: true,
              last_login_at: new Date().toISOString()
            })

          if (insertError) {
            console.error("customerSignUp insert error:", insertError)
            // Auth user was created but customer record failed — don't leave orphan
            // Still return success since they can login and we'll link later
          }
        }
      }
    }

    // DO NOT create user_profiles — customers stay as customers only
    return { success: true, needsLogin: true }
  } catch (err: any) {
    console.error("customerSignUp error:", err)
    if (err.errors) {
      // Zod validation error
      return { success: false, error: err.errors[0]?.message || "Dados inválidos." }
    }
    return { success: false, error: "Erro ao criar conta. Tente novamente." }
  }
}

export async function customerLogin(data: z.infer<typeof customerLoginSchema>) {
  try {
    const validated = customerLoginSchema.parse(data)
    const normalizedEmail = validated.email.trim().toLowerCase()

    // Use the regular server client for signIn (it needs to set session cookies)
    const supabase = await createServerClient()

    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: validated.password,
    })

    if (signInError) {
      console.error("customerLogin auth error:", signInError.message)
      
      // Translate Supabase error messages to user-friendly Portuguese
      if (signInError.message.includes("Invalid login credentials")) {
        return { success: false, error: "E-mail ou senha incorretos." }
      }
      if (signInError.message.includes("Email not confirmed")) {
        return { success: false, error: "Confirme seu e-mail antes de acessar." }
      }
      if (signInError.message.includes("User not found")) {
        return { success: false, error: "Conta não encontrada. Cadastre-se." }
      }
      return { success: false, error: "Não foi possível entrar. Tente novamente." }
    }

    const authUserId = authData.user?.id
    if (!authUserId) {
      return { success: false, error: "Falha na autenticação. Tente novamente." }
    }

    // Ensure customer record exists and is linked (auto-sync)
    await ensureCustomerForAuthUser(authUserId, {
      email: normalizedEmail,
      fullName: authData.user.user_metadata?.full_name,
      phone: authData.user.user_metadata?.phone,
    })

    return { success: true }
  } catch (err: any) {
    console.error("customerLogin error:", err)
    return { success: false, error: "Erro ao fazer login. Tente novamente." }
  }
}

/**
 * Ensure a customer record exists for the given auth user.
 * Called after login to sync customer data.
 * Uses SERVICE_ROLE_KEY to bypass RLS.
 */
export async function ensureCustomerForAuthUser(
  authUserId: string,
  optionalData?: { email?: string; fullName?: string; phone?: string }
): Promise<{ customerId: string | null }> {
  try {
    const adminClient = getAdminClient()

    // 1. Look up by auth_user_id
    const { data: existing } = await adminClient
      .from("customers")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle()

    if (existing) {
      // Update last_login_at
      await adminClient
        .from("customers")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", existing.id)
      return { customerId: existing.id }
    }

    // 2. Look up by email
    if (optionalData?.email) {
      const { data: byEmail } = await adminClient
        .from("customers")
        .select("id, auth_user_id")
        .eq("email", optionalData.email.trim().toLowerCase())
        .maybeSingle()

      if (byEmail) {
        // Link unlinked customer
        if (!byEmail.auth_user_id) {
          await adminClient
            .from("customers")
            .update({ 
              auth_user_id: authUserId,
              last_login_at: new Date().toISOString()
            })
            .eq("id", byEmail.id)
        }
        return { customerId: byEmail.id }
      }
    }

    // 3. Look up by phone
    if (optionalData?.phone) {
      const normalizedPhone = optionalData.phone.replace(/\D/g, '')
      if (normalizedPhone.length >= 10) {
        const { data: byPhone } = await adminClient
          .from("customers")
          .select("id, auth_user_id")
          .eq("mobile_phone", normalizedPhone)
          .maybeSingle()

        if (byPhone && !byPhone.auth_user_id) {
          await adminClient
            .from("customers")
            .update({ 
              auth_user_id: authUserId,
              email: optionalData.email?.trim().toLowerCase(),
              last_login_at: new Date().toISOString()
            })
            .eq("id", byPhone.id)
          return { customerId: byPhone.id }
        }
      }
    }

    // 4. Create new customer
    const { data: newCustomer, error: insertErr } = await adminClient
      .from("customers")
      .insert({
        auth_user_id: authUserId,
        full_name: optionalData?.fullName || 'Cliente',
        normalized_name: (optionalData?.fullName || 'cliente').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        email: optionalData?.email?.trim().toLowerCase(),
        mobile_phone: optionalData?.phone?.replace(/\D/g, ''),
        is_active: true,
        last_login_at: new Date().toISOString()
      })
      .select("id")
      .single()

    if (insertErr) {
      console.error("ensureCustomerForAuthUser insert error:", insertErr)
      return { customerId: null }
    }

    return { customerId: newCustomer?.id || null }
  } catch (err: any) {
    console.error("ensureCustomerForAuthUser error:", err)
    return { customerId: null }
  }
}

export async function customerLogout() {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  return { success: true }
}
