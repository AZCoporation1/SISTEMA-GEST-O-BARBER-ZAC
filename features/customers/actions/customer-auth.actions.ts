"use server"

/**
 * Customer Auth Actions — Cadastro, Login, Logout, Perfil do Cliente
 * Uses SUPABASE_SERVICE_ROLE_KEY server-side to bypass RLS for customer management.
 * 
 * CRITICAL RULE: No user_profile = NOT internal. Always customer or needs_customer_sync.
 */

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from "@/lib/supabase/server"
import { z } from "zod"
import { ensureCustomerForAuthUser as _ensureSync } from '@/features/customers/services/customer-auth-sync.service'
import type { EnsureCustomerResult } from '@/features/customers/services/customer-auth-sync.service'
import { resolveCustomerAreaIdentity } from '@/features/customers/services/resolve-identity'

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

    if (!ensureResult.success || !ensureResult.customerId) {
      console.error("customerSignUp: ensureSync failed after auth user created:", ensureResult.error, "code:", ensureResult.code)
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

    // Always ensure customer exists on login (idempotent)
    // This handles: new users, orphan users, and returning users
    await _ensureSync(authUserId, {
      email: normalizedEmail,
      fullName: authData.user.user_metadata?.full_name,
      phone: authData.user.user_metadata?.phone,
    })

    // For internal_only or dual_identity, login succeeds but pages handle the display
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
): Promise<EnsureCustomerResult> {
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

    // Use central identity resolver
    const identity = await resolveCustomerAreaIdentity(authData.user.id, authData.user.email)

    // ── ALWAYS try to create/find customer FIRST on customer routes ──
    // This handles cases where Supabase identity linking causes a Google user
    // to inherit an existing auth_user_id with user_profile. The customer area
    // should ALWAYS serve the user as customer first.
    
    let customerId = identity.customerId

    // If no customer exists yet, try to create one (regardless of user_profile)
    if (!customerId) {
      const ensureResult = await _ensureSync(authData.user.id, {
        email: authData.user.email,
        fullName: authData.user.user_metadata?.full_name || authData.user.user_metadata?.name,
        phone: authData.user.user_metadata?.phone,
      })
      customerId = ensureResult.customerId
      
      if (!ensureResult.success || !customerId) {
        // Customer creation FAILED — now check why
        if (ensureResult.code === 'CONFLICT_EMAIL' || ensureResult.code === 'CONFLICT_PHONE') {
          return {
            success: false,
            error: ensureResult.error || "Este e-mail/telefone já está vinculado a outro cliente. Entre com a conta correta ou fale com a barbearia.",
            data: null,
            isInternalUser: false,
            canAccessERP: false,
            erpRedirectPath: null,
          }
        }
        
        if (identity.hasUserProfile) {
          // Has user_profile but customer creation failed → real internal user
          return {
            success: false,
            error: "Esta conta pertence ao sistema interno do Barber Zac.",
            data: null,
            isInternalUser: true,
            canAccessERP: identity.canAccessERP,
            erpRedirectPath: identity.erpRedirectPath,
            systemRole: identity.systemRole,
          }
        }

        // No user_profile, no customer — generic error with code
        return {
          success: false,
          error: ensureResult.error || "Não foi possível criar seu perfil de cliente. Tente novamente.",
          data: null,
          isInternalUser: false,
          canAccessERP: false,
          erpRedirectPath: null,
          syncCode: ensureResult.code,
        }
      }
    }

    // ── Customer exists (created or found) — show profile ──
    const adminClient = getAdminClient()

    // Parallel: customer data + upcoming count are independent reads
    const [customerResult, countResult] = await Promise.all([
      adminClient
        .from("customers")
        .select("id, full_name, email, phone, mobile_phone, avatar_url, loyalty_points, notes, created_at")
        .eq("id", customerId)
        .single(),
      adminClient
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customerId)
        .gte("start_at", new Date().toISOString())
        .not("status", "in", '("cancelled","no_show")'),
    ])

    const customer = customerResult.data as any
    const count = countResult.count

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
      isInternalUser: identity.hasUserProfile,
      canAccessERP: identity.canAccessERP,
      erpRedirectPath: identity.erpRedirectPath,
      systemRole: identity.systemRole,
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

    // Ensure customer exists first
    const ensureResult = await _ensureSync(authData.user.id, {
      email: authData.user.email,
      fullName: authData.user.user_metadata?.full_name,
      phone: authData.user.user_metadata?.phone,
    })

    if (!ensureResult.success || !ensureResult.customerId) {
      return { success: false, error: "Registro de cliente não encontrado." }
    }

    const adminClient = getAdminClient()
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
      .eq("id", ensureResult.customerId)

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

    // Ensure customer exists first
    const ensureResult = await _ensureSync(authData.user.id, {
      email: authData.user.email,
    })

    if (!ensureResult.success || !ensureResult.customerId) {
      return { success: false, error: "Registro de cliente não encontrado." }
    }

    const adminClient = getAdminClient()
    const { error } = await adminClient
      .from("customers")
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq("id", ensureResult.customerId)

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
      return { success: false, error: "Não autenticado.", data: null, isInternalUser: false, canAccessERP: false }
    }

    // Use central identity resolver
    const identity = await resolveCustomerAreaIdentity(authData.user.id, authData.user.email)

    // ── ALWAYS try to create/find customer FIRST ──
    // Same pattern as getCustomerProfile: customer area should always serve as customer first.
    let customerId = identity.customerId
    let customerName: string | null = null

    if (!customerId) {
      const ensureResult = await _ensureSync(authData.user.id, {
        email: authData.user.email,
        fullName: authData.user.user_metadata?.full_name || authData.user.user_metadata?.name,
        phone: authData.user.user_metadata?.phone,
      })
      customerId = ensureResult.customerId
      customerName = ensureResult.fullName

      if (!ensureResult.success || !customerId) {
        // Customer creation failed — now check why
        if (ensureResult.code === 'CONFLICT_EMAIL' || ensureResult.code === 'CONFLICT_PHONE') {
          return {
            success: false,
            error: ensureResult.error || "Este e-mail já está vinculado a outro cliente.",
            data: null,
            isInternalUser: false,
            canAccessERP: false,
            customerName: null,
          }
        }

        if (identity.hasUserProfile) {
          return {
            success: false,
            error: "Esta conta pertence ao sistema interno do Barber Zac.",
            data: null,
            isInternalUser: true,
            canAccessERP: identity.canAccessERP,
            erpRedirectPath: identity.erpRedirectPath,
            customerName: null,
          }
        }

        return {
          success: false,
          error: ensureResult.error || "Não foi possível criar seu perfil de cliente.",
          data: null,
          isInternalUser: false,
          canAccessERP: false,
          customerName: null,
        }
      }
    }

    // Fetch appointments via service_role (bypass RLS)
    const adminClient = getAdminClient()

    if (!customerName) {
      const { data: custData } = await adminClient
        .from('customers')
        .select('full_name')
        .eq('id', customerId)
        .single() as { data: any }
      customerName = custData?.full_name || null
    }

    const { data: appointments } = await adminClient
      .from('appointments')
      .select(`
        id,
        start_at,
        end_at,
        status,
        customer_id,
        service_name_snapshot,
        service_price_snapshot,
        cancellation_reason,
        professional_id,
        collaborators (name)
      `)
      .eq('customer_id', customerId)
      .order('start_at', { ascending: false })
      .limit(50) as { data: any[] | null }

    return {
      success: true,
      data: appointments || [],
      isInternalUser: identity.hasUserProfile,
      canAccessERP: identity.canAccessERP,
      erpRedirectPath: identity.erpRedirectPath,
      customerName,
    }
  } catch (err: any) {
    console.error("getCustomerAppointments error:", err)
    return { success: false, error: "Erro ao carregar agendamentos.", data: null, isInternalUser: false, canAccessERP: false }
  }
}

/**
 * Create customer record for an internal user (dual identity).
 * EXPLICIT action — never automatic.
 */
export async function createCustomerForInternalUser() {
  try {
    const supabase = await createServerClient()
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user?.id) {
      return { success: false, error: "Não autenticado." }
    }

    // Verify this IS an internal user
    const identity = await resolveCustomerAreaIdentity(authData.user.id, authData.user.email)
    if (identity.status !== 'internal_only') {
      return { success: false, error: "Esta ação é apenas para contas internas sem perfil de cliente." }
    }

    // Create customer via ensure
    const ensureResult = await _ensureSync(authData.user.id, {
      email: authData.user.email,
      fullName: authData.user.user_metadata?.full_name || authData.user.user_metadata?.name,
      phone: authData.user.user_metadata?.phone,
    })

    if (!ensureResult.success || !ensureResult.customerId) {
      return { success: false, error: ensureResult.error || "Não foi possível criar perfil de cliente." }
    }

    return { success: true, customerId: ensureResult.customerId }
  } catch (err: any) {
    console.error("createCustomerForInternalUser error:", err)
    return { success: false, error: "Erro ao criar perfil de cliente." }
  }
}
