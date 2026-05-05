"use server"

/**
 * Customer Auth Actions — Cadastro, Login, Logout, Perfil do Cliente
 * Uses SUPABASE_SERVICE_ROLE_KEY server-side to bypass RLS for customer management.
 */

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from "@/lib/supabase/server"
import { z } from "zod"
import { ensureCustomerForAuthUser as _ensureSync } from '@/features/customers/services/customer-auth-sync.service'

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

    // PRE-CHECK: Verify no existing customer is linked to a different auth user
    const { data: existingByEmail } = await adminClient
      .from("customers")
      .select("id, auth_user_id")
      .eq("email", normalizedEmail)
      .maybeSingle() as { data: any }

    if (existingByEmail?.auth_user_id) {
      // Already linked to another auth user → block signup
      return { success: false, error: "Este e-mail já está vinculado a outra conta. Faça login." }
    }

    const { data: existingByPhone } = await adminClient
      .from("customers")
      .select("id, auth_user_id")
      .eq("mobile_phone", normalizedPhone)
      .maybeSingle() as { data: any }

    if (existingByPhone?.auth_user_id) {
      return { success: false, error: "Este telefone já está vinculado a outra conta. Faça login." }
    }

    // 1. Create Auth user via admin API (bypasses email confirmation)
    const { data: authData, error: signUpError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: validated.password,
      email_confirm: true,
      user_metadata: {
        full_name: validated.fullName,
        phone: normalizedPhone,
        user_type: "customer",
      },
    })

    if (signUpError) {
      console.error("customerSignUp auth error:", signUpError)
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

    // 2. Use ensureCustomerForAuthUser to handle all dedup/linking logic
    const ensureResult = await _ensureSync(authUserId, {
      email: normalizedEmail,
      fullName: validated.fullName,
      phone: normalizedPhone,
    })

    if (!ensureResult.customerId) {
      console.error("customerSignUp: ensureSync failed after auth user created:", ensureResult.error)
      // Auth user was created — they can still login, sync will retry
    }

    // DO NOT create user_profiles — customers stay as customers only
    return { success: true, needsLogin: true }
  } catch (err: any) {
    console.error("customerSignUp error:", err)
    if (err.errors) {
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
    await _ensureSync(authUserId, {
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
 * Wrapper for ensureCustomerForAuthUser from the shared service.
 * Must be an async function because this is a "use server" file.
 */
export async function ensureCustomerForAuthUser(
  authUserId: string,
  optionalData?: { email?: string; fullName?: string; phone?: string }
) {
  return _ensureSync(authUserId, optionalData)
}

export async function customerLogout() {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  return { success: true }
}

// ─── Profile CRUD ───────────────────────────────────────────────────────

export async function getCustomerProfile() {
  try {
    const supabase = await createServerClient()
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user?.id) {
      return { success: false, error: "Não autenticado.", data: null }
    }

    // Check if this is an admin/professional account
    const adminClient = getAdminClient()
    const { data: profile } = await adminClient
      .from("user_profiles")
      .select("system_role")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle() as { data: any }

    const isInternalUser = !!profile?.system_role

    // Ensure customer exists
    const ensureResult = await _ensureSync(authData.user.id, {
      email: authData.user.email,
      fullName: authData.user.user_metadata?.full_name,
      phone: authData.user.user_metadata?.phone,
    })

    if (!ensureResult.customerId) {
      return {
        success: false,
        error: ensureResult.error || "Não foi possível vincular seu registro de cliente.",
        data: null,
        isInternalUser,
      }
    }

    // Fetch full customer data
    const { data: customer } = await adminClient
      .from("customers")
      .select("id, full_name, email, phone, mobile_phone, avatar_url, loyalty_points, notes, created_at")
      .eq("id", ensureResult.customerId)
      .single() as { data: any }

    // Count upcoming appointments
    const { count } = await adminClient
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", ensureResult.customerId)
      .gte("start_at", new Date().toISOString())
      .not("status", "in", '("cancelled","no_show")')

    return {
      success: true,
      data: {
        id: customer?.id,
        fullName: customer?.full_name,
        email: customer?.email,
        phone: customer?.mobile_phone || customer?.phone,
        avatarUrl: customer?.avatar_url,
        loyaltyPoints: customer?.loyalty_points ?? 0,
        memberSince: customer?.created_at,
        upcomingAppointments: count || 0,
      },
      isInternalUser,
    }
  } catch (err: any) {
    console.error("getCustomerProfile error:", err)
    return { success: false, error: "Erro ao carregar perfil.", data: null }
  }
}

const updateProfileSchema = z.object({
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
  phone: z.string().min(10, "Telefone inválido").optional(),
})

export async function updateCustomerProfile(data: { fullName?: string; phone?: string }) {
  try {
    const validated = updateProfileSchema.parse(data)
    const supabase = await createServerClient()
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user?.id) {
      return { success: false, error: "Não autenticado." }
    }

    const adminClient = getAdminClient()

    // Get customer id
    const { data: customer } = await adminClient
      .from("customers")
      .select("id")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle() as { data: any }

    if (!customer) {
      return { success: false, error: "Registro de cliente não encontrado." }
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    if (validated.fullName) {
      updates.full_name = validated.fullName
      updates.normalized_name = validated.fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    }
    if (validated.phone) {
      updates.mobile_phone = validated.phone.replace(/\D/g, '')
    }

    const { error } = await adminClient
      .from("customers")
      .update(updates)
      .eq("id", customer.id)

    if (error) {
      console.error("updateCustomerProfile error:", error)
      return { success: false, error: "Erro ao atualizar perfil." }
    }

    return { success: true }
  } catch (err: any) {
    console.error("updateCustomerProfile error:", err)
    if (err.errors) {
      return { success: false, error: err.errors[0]?.message || "Dados inválidos." }
    }
    return { success: false, error: "Erro ao atualizar perfil." }
  }
}

export async function updateCustomerAvatar(avatarUrl: string) {
  try {
    const supabase = await createServerClient()
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user?.id) {
      return { success: false, error: "Não autenticado." }
    }

    const adminClient = getAdminClient()
    const { data: customer } = await adminClient
      .from("customers")
      .select("id")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle() as { data: any }

    if (!customer) {
      return { success: false, error: "Registro de cliente não encontrado." }
    }

    const { error } = await adminClient
      .from("customers")
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq("id", customer.id)

    if (error) {
      console.error("updateCustomerAvatar error:", error)
      return { success: false, error: "Erro ao atualizar foto." }
    }

    return { success: true }
  } catch (err: any) {
    console.error("updateCustomerAvatar error:", err)
    return { success: false, error: "Erro ao atualizar foto." }
  }
}

/**
 * Get customer's appointments via service_role (bypasses RLS)
 */
export async function getCustomerAppointments() {
  try {
    const supabase = await createServerClient()
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user?.id) {
      return { success: false, error: "Não autenticado.", data: null, isInternalUser: false }
    }

    // Check if internal user
    const adminClient = getAdminClient()
    const { data: profile } = await adminClient
      .from("user_profiles")
      .select("system_role")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle() as { data: any }

    const isInternalUser = !!profile?.system_role

    // Ensure customer exists
    const ensureResult = await _ensureSync(authData.user.id, {
      email: authData.user.email,
      fullName: authData.user.user_metadata?.full_name,
      phone: authData.user.user_metadata?.phone,
    })

    if (!ensureResult.customerId) {
      return {
        success: false,
        error: ensureResult.error || "Não foi possível vincular seu registro de cliente.",
        data: null,
        isInternalUser,
        customerName: null,
      }
    }

    // Fetch appointments via service_role (bypass RLS)
    const { data: appointments } = await adminClient
      .from('appointments')
      .select(`
        id,
        start_at,
        status,
        service_name_snapshot,
        service_price_snapshot,
        professional_id,
        collaborators (name)
      `)
      .eq('customer_id', ensureResult.customerId)
      .order('start_at', { ascending: false }) as { data: any[] | null }

    return {
      success: true,
      data: appointments || [],
      isInternalUser,
      customerName: ensureResult.fullName,
    }
  } catch (err: any) {
    console.error("getCustomerAppointments error:", err)
    return { success: false, error: "Erro ao carregar agendamentos.", data: null, isInternalUser: false }
  }
}
