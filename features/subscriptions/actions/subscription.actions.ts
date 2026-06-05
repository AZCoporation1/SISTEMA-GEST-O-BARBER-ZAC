"use server"

/**
 * Barber Zac ERP — Subscription Actions
 *
 * Server actions for the monthly subscription module.
 * Handles plan retrieval, availability checking, subscription lifecycle,
 * occurrence tracking, subscriber discount logic, internal creation,
 * payment registration, and usage management.
 *
 * Rules:
 * - Backend is SOURCE OF TRUTH for all prices, discounts, and status
 * - Appointments use service_price_snapshot=0 to avoid duplicating revenue
 * - Activation only via admin manual or approved payment
 * - Idempotent: no duplicate occurrences/appointments
 * - Usage count derived from subscription_occurrences (source of truth)
 */

import { createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"
import { dispatchNotification, resolveAdminTargets, resolveProfessionalTarget } from "@/features/notifications/services/notificationRouter.service"
import { buildSubscriptionClosedPayload, buildSubscriptionCancelledPayload } from "@/features/notifications/services/eventPayloads"
import { revalidatePath } from "next/cache"
import type {
  SubscriptionPlanRow,
  SubscriptionPlanWithProfessionals,
  CustomerSubscriptionRow,
  SubscriptionOccurrenceRow,
  SubscriptionStatus,
  SubscriptionUsageSummary,
  VisitTemplateEntry,
} from "../types"

// ── Helpers ──────────────────────────────────────────────────

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getUserContext(supabase: any) {
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData.user?.id
  const userProfileId = await resolveUserProfileId(supabase, userId)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('system_role, collaborator_id')
    .eq('auth_user_id', userId)
    .single()
  return {
    userId,
    userProfileId,
    systemRole: profile?.system_role || 'unknown',
    collaboratorId: profile?.collaborator_id || null,
    hasAdminAccess: ['admin_total', 'owner_admin_professional'].includes(profile?.system_role || ''),
    isOwner: profile?.system_role === 'owner_admin_professional',
  }
}

// ── Cash register integration helper ─────────────────────

/**
 * Registers a subscription payment in the cash register (caixa).
 * Only called when payment status is 'paid' at the moment of payment.
 * Creates:
 * 1. cash_entries record (income) in the active session
 * 2. financial_movements record (received) for financial tracking
 *
 * If no cash session is open, the payment is still recorded in subscription_payments
 * but NOT in the caixa (will appear only in financial_movements).
 */
async function registerPaymentInCashRegister(
  supabaseClient: any,
  data: {
    amount: number
    paymentMethod: string
    customerName: string
    planName: string
    subscriptionId: string
    operatorId: string | null
  }
) {
  try {
    const description = `Assinatura: ${data.planName} — ${data.customerName}`
    const now = new Date().toISOString()

    // Check for active cash session
    const { data: activeSession } = await supabaseClient
      .from('cash_sessions')
      .select('id')
      .eq('status', 'open')
      .single()

    // If cash session is open, register as income entry
    if (activeSession) {
      await supabaseClient.from('cash_entries').insert({
        cash_session_id: activeSession.id,
        entry_type: 'income',
        amount: data.amount,
        category: 'Assinatura Mensal',
        description,
        reference_type: 'subscription_payment',
        reference_id: data.subscriptionId,
        created_by: data.operatorId,
      })
    }

    // Always mirror to financial_movements for financial tracking
    await supabaseClient.from('financial_movements').insert({
      movement_type: 'received',
      amount: data.amount,
      category: 'Receita de Assinatura',
      subcategory: 'Assinatura Mensal',
      description,
      origin_type: 'subscription_payment',
      origin_id: data.subscriptionId,
      occurred_on: now,
    })
  } catch (err) {
    // Cash integration failure must NOT break subscription flow
    console.error('registerPaymentInCashRegister error (non-blocking):', err)
  }
}

// ══════════════════════════════════════════════════════════
// PUBLIC: Get Subscription Plans (for customer portal)
// ══════════════════════════════════════════════════════════

export async function getPublicSubscriptionPlans(): Promise<{
  success: boolean
  data?: SubscriptionPlanWithProfessionals[]
  error?: string
}> {
  try {
    // Feature flag check
    if (process.env.SUBSCRIPTIONS_ENABLED === 'false') {
      return { success: true, data: [] }
    }

    const supabase = getAdminClient()

    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .eq('show_in_customer_portal', true)
      .eq('needs_manual_review', false)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('getPublicSubscriptionPlans error:', error)
      return { success: false, error: 'Erro ao carregar planos.' }
    }

    if (!plans || plans.length === 0) {
      return { success: true, data: [] }
    }

    // Fetch allowed professionals for each plan
    const planIds = plans.map((p: any) => p.id)
    const { data: planProfs } = await supabase
      .from('subscription_plan_professionals')
      .select('plan_id, professional_id, collaborators(id, name, display_name)')
      .in('plan_id', planIds)

    const profsByPlan: Record<string, any[]> = {}
    for (const pp of (planProfs || [])) {
      if (!profsByPlan[pp.plan_id]) profsByPlan[pp.plan_id] = []
      profsByPlan[pp.plan_id].push({
        id: (pp as any).collaborators?.id || pp.professional_id,
        name: (pp as any).collaborators?.name || 'Profissional',
        display_name: (pp as any).collaborators?.display_name || null,
      })
    }

    const enriched: SubscriptionPlanWithProfessionals[] = plans.map((p: any) => ({
      ...p,
      professionals: profsByPlan[p.id] || [],
    }))

    return { success: true, data: enriched }
  } catch (err: any) {
    console.error('getPublicSubscriptionPlans error:', err)
    return { success: false, error: 'Erro interno.' }
  }
}

// ══════════════════════════════════════════════════════════
// ADMIN: Get All Subscription Plans (no portal filter)
// ══════════════════════════════════════════════════════════

export async function getAdminSubscriptionPlans(): Promise<{
  success: boolean
  data?: SubscriptionPlanWithProfessionals[]
  error?: string
}> {
  try {
    const supabase = getAdminClient()

    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      return { success: false, error: 'Erro ao carregar planos.' }
    }

    if (!plans || plans.length === 0) {
      return { success: true, data: [] }
    }

    const planIds = plans.map((p: any) => p.id)
    const { data: planProfs } = await supabase
      .from('subscription_plan_professionals')
      .select('plan_id, professional_id, collaborators(id, name, display_name)')
      .in('plan_id', planIds)

    const profsByPlan: Record<string, any[]> = {}
    for (const pp of (planProfs || [])) {
      if (!profsByPlan[pp.plan_id]) profsByPlan[pp.plan_id] = []
      profsByPlan[pp.plan_id].push({
        id: (pp as any).collaborators?.id || pp.professional_id,
        name: (pp as any).collaborators?.name || 'Profissional',
        display_name: (pp as any).collaborators?.display_name || null,
      })
    }

    const enriched: SubscriptionPlanWithProfessionals[] = plans.map((p: any) => ({
      ...p,
      professionals: profsByPlan[p.id] || [],
    }))

    return { success: true, data: enriched }
  } catch (err: any) {
    console.error('getAdminSubscriptionPlans error:', err)
    return { success: false, error: 'Erro interno.' }
  }
}

// ══════════════════════════════════════════════════════════
// ADMIN: Get Allowed Professionals for a Plan
// ══════════════════════════════════════════════════════════

export async function getPlanAllowedProfessionals(planId: string): Promise<{
  success: boolean
  data?: Array<{ id: string; name: string; display_name: string | null }>
  error?: string
}> {
  try {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from('subscription_plan_professionals')
      .select('professional_id, collaborators(id, name, display_name)')
      .eq('plan_id', planId)

    if (error) {
      return { success: false, error: 'Erro ao carregar profissionais.' }
    }

    const professionals = (data || []).map((pp: any) => ({
      id: pp.collaborators?.id || pp.professional_id,
      name: pp.collaborators?.name || 'Profissional',
      display_name: pp.collaborators?.display_name || null,
    }))

    return { success: true, data: professionals }
  } catch (err: any) {
    return { success: false, error: 'Erro interno.' }
  }
}

// ══════════════════════════════════════════════════════════
// PUBLIC: Check if professional is allowed for a plan
// ══════════════════════════════════════════════════════════

export async function checkPlanProfessionalAllowed(
  planId: string,
  professionalId: string
): Promise<boolean> {
  try {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('subscription_plan_professionals')
      .select('plan_id')
      .eq('plan_id', planId)
      .eq('professional_id', professionalId)
      .single()
    return !!data
  } catch {
    return false
  }
}

// ══════════════════════════════════════════════════════════
// PUBLIC: Check Recurring Availability
// ══════════════════════════════════════════════════════════

export async function checkSubscriptionAvailability(input: {
  professionalId: string
  weekday: number        // 0-6
  time: string           // "HH:MM"
  durationMinutes: number
  visitsCount: number
  periodStartDate?: string  // optional: force start date
}): Promise<{
  success: boolean
  data?: Array<{
    date: string
    startAt: string
    endAt: string
    available: boolean
    conflictReason?: string
  }>
  error?: string
}> {
  try {
    const supabase = getAdminClient()
    const { professionalId, weekday, time, durationMinutes, visitsCount } = input

    // Validate professional is allowed
    const { data: profCheck } = await supabase
      .from('collaborators')
      .select('id, is_active')
      .eq('id', professionalId)
      .eq('is_active', true)
      .single()

    if (!profCheck) {
      return { success: false, error: 'Profissional não encontrado ou inativo.' }
    }

    // Generate next N occurrence dates
    const occurrences: Array<{ date: string; startAt: string; endAt: string }> = []
    const today = new Date()
    let checkDate = new Date(today)

    // If a start date is specified, use it
    if (input.periodStartDate) {
      checkDate = new Date(input.periodStartDate + 'T12:00:00-03:00')
    }

    // Find next occurrence of the selected weekday
    while (checkDate.getDay() !== weekday) {
      checkDate.setDate(checkDate.getDate() + 1)
    }

    // If the first occurrence is today but time has passed, skip to next week
    const [hh, mm] = time.split(':').map(Number)
    const nowMinutes = today.getHours() * 60 + today.getMinutes()
    if (checkDate.toDateString() === today.toDateString() && (hh * 60 + mm) <= nowMinutes) {
      checkDate.setDate(checkDate.getDate() + 7)
    }

    for (let i = 0; i < visitsCount; i++) {
      const dateStr = checkDate.toISOString().split('T')[0]
      const startAt = `${dateStr}T${time}:00-03:00`
      const endDate = new Date(new Date(startAt).getTime() + durationMinutes * 60000)
      const endAt = endDate.toISOString()

      occurrences.push({ date: dateStr, startAt, endAt })
      checkDate.setDate(checkDate.getDate() + 7)
    }

    // Check conflicts for each occurrence
    const results = []
    for (const occ of occurrences) {
      // Check appointments
      const { data: conflicts } = await supabase
        .from('appointments')
        .select('id, start_at, end_at, status')
        .eq('professional_id', professionalId)
        .in('status', ['scheduled', 'confirmed', 'checked_in'])
        .lt('start_at', occ.endAt)
        .gt('end_at', occ.startAt)

      // Check blocks
      const { data: blocks } = await supabase
        .from('appointment_blocks')
        .select('id, start_at, end_at')
        .eq('professional_id', professionalId)
        .eq('is_active', true)
        .lt('start_at', occ.endAt)
        .gt('end_at', occ.startAt)

      // Check working hours
      const { data: workHours } = await supabase
        .from('professional_working_hours')
        .select('start_time, end_time')
        .eq('professional_id', professionalId)
        .eq('weekday', weekday)
        .eq('is_active', true)
        .single()

      let conflictReason: string | undefined
      if (!workHours) {
        conflictReason = 'Profissional não trabalha neste dia'
      } else if (conflicts && conflicts.length > 0) {
        conflictReason = 'Horário já ocupado'
      } else if (blocks && blocks.length > 0) {
        conflictReason = 'Profissional bloqueado neste horário'
      }

      results.push({
        date: occ.date,
        startAt: occ.startAt,
        endAt: occ.endAt,
        available: !conflictReason,
        conflictReason,
      })
    }

    return { success: true, data: results }
  } catch (err: any) {
    console.error('checkSubscriptionAvailability error:', err)
    return { success: false, error: 'Erro ao verificar disponibilidade.' }
  }
}

// ══════════════════════════════════════════════════════════
// PUBLIC: Create Subscription Draft (customer portal)
// ══════════════════════════════════════════════════════════

export async function createSubscriptionDraft(input: {
  customerId: string
  planId: string
  professionalId: string
  fixedWeekday: number
  fixedTime: string
}): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
  try {
    const supabase = getAdminClient()

    // Validate plan exists and is active
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', input.planId)
      .eq('is_active', true)
      .single()

    if (!plan) {
      return { success: false, error: 'Plano não encontrado ou inativo.' }
    }

    // Validate professional is allowed for this plan
    const allowed = await checkPlanProfessionalAllowed(input.planId, input.professionalId)
    if (!allowed) {
      return { success: false, error: 'Profissional não permitido para este plano.' }
    }

    // Check customer exists
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', input.customerId)
      .single()

    if (!customer) {
      return { success: false, error: 'Cliente não encontrado.' }
    }

    // Check customer doesn't already have an active subscription
    const { data: existingSub } = await supabase
      .from('customer_subscriptions')
      .select('id')
      .eq('customer_id', input.customerId)
      .in('status', ['active', 'pending_payment'])
      .single()

    if (existingSub) {
      return { success: false, error: 'Cliente já possui assinatura ativa ou pendente.' }
    }

    // Check recurring availability before creating draft
    const availCheck = await checkSubscriptionAvailability({
      professionalId: input.professionalId,
      weekday: input.fixedWeekday,
      time: input.fixedTime,
      durationMinutes: plan.duration_minutes_per_visit,
      visitsCount: plan.visits_per_cycle,
    })

    if (availCheck.data) {
      const hasConflict = availCheck.data.some(d => !d.available)
      if (hasConflict) {
        return {
          success: false,
          error: 'Existem conflitos de horário. Escolha outro dia/horário.',
        }
      }
    }

    // Create draft subscription
    const { data: sub, error: subErr } = await supabase
      .from('customer_subscriptions')
      .insert({
        customer_id: input.customerId,
        plan_id: input.planId,
        status: 'pending_payment',
        fixed_weekday: input.fixedWeekday,
        fixed_time: input.fixedTime,
        preferred_professional_id: input.professionalId,
        payment_provider: 'placeholder',
        checkout_mode: 'placeholder',
        subscriber_discount_percent: 7,
        source: 'customer_portal',
      })
      .select('id')
      .single()

    if (subErr) {
      console.error('createSubscriptionDraft error:', subErr)
      return { success: false, error: 'Erro ao criar assinatura.' }
    }

    return { success: true, subscriptionId: sub.id }
  } catch (err: any) {
    console.error('createSubscriptionDraft error:', err)
    return { success: false, error: err.message || 'Erro interno.' }
  }
}

// ══════════════════════════════════════════════════════════
// ADMIN: Create Internal Subscription (full flow)
// ══════════════════════════════════════════════════════════

export async function createInternalSubscription(input: {
  customerId: string
  planId: string
  professionalId: string
  fixedWeekday: number       // 0-6
  fixedTime: string          // "HH:MM"
  billingDay: number         // 1-31
  status: 'active' | 'pending_payment' | 'draft'
  paymentMethod?: string     // 'dinheiro' | 'pix' | 'cartao' | 'manual'
  paymentStatus?: 'paid' | 'pending' | 'waived'
  notes?: string
  confirmDuplicate?: boolean // admin confirmed duplicate subscription
  isCustomized?: boolean
  customPlanName?: string
  customServicesSnapshot?: any
  monthlyPriceSnapshot?: number
  visitsPerCycleSnapshot?: number
  durationMinutesSnapshot?: number
}): Promise<{ success: boolean; subscriptionId?: string; warning?: string; error?: string }> {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    if (!ctx.hasAdminAccess) {
      return { success: false, error: 'Apenas administradores podem criar assinaturas internas.' }
    }

    const adminClient = getAdminClient()

    // ── Validate plan ──
    const { data: plan } = await adminClient
      .from('subscription_plans')
      .select('*')
      .eq('id', input.planId)
      .eq('is_active', true)
      .single()

    if (!plan) {
      return { success: false, error: 'Plano não encontrado ou inativo.' }
    }

    // ── Validate professional is active (admin can assign any professional) ──
    const { data: profCheck } = await adminClient
      .from('collaborators')
      .select('id, is_active')
      .eq('id', input.professionalId)
      .eq('is_active', true)
      .single()

    if (!profCheck) {
      return { success: false, error: 'Profissional não encontrado ou inativo.' }
    }

    // ── Validate customer ──
    const { data: customer } = await adminClient
      .from('customers')
      .select('id, full_name')
      .eq('id', input.customerId)
      .single()

    if (!customer) {
      return { success: false, error: 'Cliente não encontrado.' }
    }

    // ── Validate billing_day ──
    if (input.billingDay < 1 || input.billingDay > 31) {
      return { success: false, error: 'Dia de pagamento deve ser entre 1 e 31.' }
    }

    // ── Validate weekday ──
    if (input.fixedWeekday < 0 || input.fixedWeekday > 6) {
      return { success: false, error: 'Dia da semana inválido.' }
    }

    // ── Validate time format ──
    if (!/^\d{2}:\d{2}$/.test(input.fixedTime)) {
      return { success: false, error: 'Horário inválido. Use formato HH:MM.' }
    }

    // ── Check duplicate active subscription (warn but allow if confirmed) ──
    const { data: existingSubs } = await adminClient
      .from('customer_subscriptions')
      .select('id, status, subscription_plans(display_name)')
      .eq('customer_id', input.customerId)
      .in('status', ['active', 'pending_payment', 'draft'])

    const hasExisting = existingSubs && existingSubs.length > 0
    if (hasExisting && !input.confirmDuplicate) {
      const existingList = existingSubs!.map((s: any) =>
        `${(s as any).subscription_plans?.display_name || 'Plano'} (${s.status})`
      ).join(', ')
      return {
        success: false,
        warning: `Este cliente já possui assinatura(s) ativa(s): ${existingList}. Deseja criar mesmo assim?`,
        error: 'DUPLICATE_WARNING',
      }
    }
    const duplicateWarning = hasExisting
      ? 'Cliente já possuía assinatura(s) ativa(s). Nova assinatura criada com confirmação do admin.'
      : undefined

    // ── Check recurring availability ──
    const durationMin = input.isCustomized && input.durationMinutesSnapshot ? input.durationMinutesSnapshot : plan.duration_minutes_per_visit
    const visitsCount = input.isCustomized && input.visitsPerCycleSnapshot ? input.visitsPerCycleSnapshot : plan.visits_per_cycle

    const availCheck = await checkSubscriptionAvailability({
      professionalId: input.professionalId,
      weekday: input.fixedWeekday,
      time: input.fixedTime,
      durationMinutes: durationMin,
      visitsCount: visitsCount,
    })

    if (!availCheck.success) {
      return { success: false, error: availCheck.error || 'Erro ao verificar disponibilidade.' }
    }

    if (availCheck.data) {
      const conflicts = availCheck.data.filter(d => !d.available)
      if (conflicts.length > 0) {
        const conflictList = conflicts.map(c =>
          `${new Date(c.date).toLocaleDateString('pt-BR')} — ${c.conflictReason}`
        ).join('\n')
        return {
          success: false,
          error: `Conflitos de horário encontrados:\n${conflictList}`,
        }
      }
    }

    // ── Calculate period ──
    const now = new Date()
    const periodStart = now.toISOString().split('T')[0]
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString().split('T')[0]

    const isActive = input.status === 'active'

    // ── Create subscription ──
    const { data: sub, error: subErr } = await adminClient
      .from('customer_subscriptions')
      .insert({
        customer_id: input.customerId,
        plan_id: input.planId,
        status: input.status,
        fixed_weekday: input.fixedWeekday,
        fixed_time: input.fixedTime,
        preferred_professional_id: input.professionalId,
        billing_day: input.billingDay,
        source: 'internal_admin',
        created_by: ctx.userProfileId,
        notes: input.notes || null,
        payment_provider: 'manual',
        checkout_mode: 'placeholder',
        subscriber_discount_percent: 7,
        ...(isActive ? {
          current_period_start: periodStart,
          current_period_end: periodEnd,
          starts_at: now.toISOString(),
          activated_manually: true,
          activated_by: ctx.userProfileId,
          activated_at: now.toISOString(),
        } : {}),
        is_customized: input.isCustomized || false,
        custom_plan_name: input.customPlanName || null,
        custom_services_snapshot: input.customServicesSnapshot || null,
        monthly_price_snapshot: input.monthlyPriceSnapshot || null,
        visits_per_cycle_snapshot: input.visitsPerCycleSnapshot || null,
        duration_minutes_snapshot: input.durationMinutesSnapshot || null,
      })
      .select('id')
      .single()

    if (subErr) {
      console.error('createInternalSubscription insert error:', subErr)
      return { success: false, error: 'Erro ao criar assinatura.' }
    }

    const subscriptionId = sub.id

    // ── Create payment record if applicable ──
    if (isActive || input.paymentStatus === 'paid') {
      const nextBillingDate = new Date(now.getFullYear(), now.getMonth(), input.billingDay)
      if (nextBillingDate < now) {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)
      }

      const amountToCharge = input.isCustomized && input.monthlyPriceSnapshot ? input.monthlyPriceSnapshot : plan.monthly_price
      const planName = input.isCustomized && input.customPlanName ? input.customPlanName : plan.display_name

      await adminClient.from('subscription_payments').insert({
        subscription_id: subscriptionId,
        customer_id: input.customerId,
        professional_id: input.professionalId,
        provider: 'manual',
        amount: amountToCharge,
        status: input.paymentStatus || 'paid',
        payment_method: input.paymentMethod || 'manual',
        due_at: nextBillingDate.toISOString(),
        paid_at: input.paymentStatus === 'paid' ? now.toISOString() : null,
      })

      // ── Integration with caixa: register in cash_entries + financial_movements when PAID ──
      if (input.paymentStatus === 'paid' && amountToCharge > 0) {
        await registerPaymentInCashRegister(adminClient, {
          amount: amountToCharge,
          paymentMethod: input.paymentMethod || 'manual',
          customerName: customer.full_name,
          planName: planName,
          subscriptionId,
          operatorId: ctx.userProfileId,
        })
      }
    }

    // ── Generate appointments + occurrences (only if active) ──
    if (isActive) {
      const genResult = await generateSubscriptionAppointments(subscriptionId)
      if (!genResult.success) {
        // Rollback: delete the subscription if appointments failed
        await adminClient.from('subscription_payments').delete().eq('subscription_id', subscriptionId)
        await adminClient.from('customer_subscriptions').delete().eq('id', subscriptionId)
        return { success: false, error: `Erro ao gerar agendamentos: ${genResult.error}` }
      }
    }

    // ── Audit log ──
    await logAudit({
      action: 'INSERT',
      entity: 'customer_subscriptions',
      entity_id: subscriptionId,
      newData: {
        customer_id: input.customerId,
        plan_id: input.planId,
        professional_id: input.professionalId,
        status: input.status,
        source: 'internal_admin',
        billing_day: input.billingDay,
        fixed_weekday: input.fixedWeekday,
        fixed_time: input.fixedTime,
      },
      observation: `Assinatura interna criada por admin. Cliente: ${customer.full_name}. Plano: ${plan.display_name}.`,
    })

    revalidatePath('/assinaturas')
    revalidatePath('/agendamento')
    revalidatePath('/caixa')
    revalidatePath('/fluxo-de-caixa')

    // ── Notifications ──
    try {
      const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
      let professionalName = 'Profissional'
      const { data: prof } = await adminClient.from('collaborators').select('name, display_name').eq('id', input.professionalId).single()
      if (prof) professionalName = prof.display_name || prof.name

      const notifData = {
        subscriptionId,
        customerName: customer.full_name,
        planName: plan.display_name,
        professionalName,
        professionalId: input.professionalId,
        dayOfWeek: weekdays[input.fixedWeekday] || '',
        time: input.fixedTime,
      }
      const targets = [...(await resolveAdminTargets())]
      const profTarget = await resolveProfessionalTarget(input.professionalId)
      if (profTarget) targets.push(profTarget)

      const payload = buildSubscriptionClosedPayload(notifData, 'admin')
      await dispatchNotification({
        eventType: 'subscription_closed',
        entityType: 'subscription',
        entityId: subscriptionId,
        idempotencyKey: `subscription_internal_created:${subscriptionId}`,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        targets,
        createdBy: ctx.userProfileId,
      })
    } catch {}

    return { success: true, subscriptionId }
  } catch (err: any) {
    console.error('createInternalSubscription error:', err)
    return { success: false, error: err.message || 'Erro ao criar assinatura interna.' }
  }
}

// ══════════════════════════════════════════════════════════
// ADMIN: Activate Subscription Manually
// ══════════════════════════════════════════════════════════

export async function activateSubscription(subscriptionId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    if (!ctx.hasAdminAccess) {
      return { success: false, error: 'Apenas administradores podem ativar assinaturas.' }
    }

    const adminClient = getAdminClient()

    // Fetch subscription
    const { data: sub, error: fetchErr } = await adminClient
      .from('customer_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single()

    if (fetchErr || !sub) {
      return { success: false, error: 'Assinatura não encontrada.' }
    }

    // Only draft or pending_payment can be activated
    if (sub.status === 'active') {
      return { success: false, error: 'Assinatura já está ativa.' }
    }
    if (!['draft', 'pending_payment'].includes(sub.status)) {
      return { success: false, error: `Status "${sub.status}" não pode ser ativado.` }
    }

    // Calculate period
    const now = new Date()
    const periodStart = now.toISOString().split('T')[0]
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString().split('T')[0]

    // Update subscription status
    const { error: updateErr } = await adminClient
      .from('customer_subscriptions')
      .update({
        status: 'active' as SubscriptionStatus,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        starts_at: now.toISOString(),
        activated_manually: true,
        activated_by: ctx.userProfileId,
        activated_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', subscriptionId)

    if (updateErr) throw updateErr

    // Create manual payment record
    await adminClient.from('subscription_payments').insert({
      subscription_id: subscriptionId,
      customer_id: sub.customer_id,
      provider: 'manual',
      amount: 0,
      status: 'paid',
      payment_method: 'manual',
      paid_at: now.toISOString(),
    })

    // Generate appointments for this period
    await generateSubscriptionAppointments(subscriptionId)

    await logAudit({
      action: 'UPDATE',
      entity: 'customer_subscriptions',
      entity_id: subscriptionId,
      newData: { status: 'active', period_start: periodStart, period_end: periodEnd, activated_manually: true },
      observation: `Assinatura ativada manualmente por admin.`,
    })

    revalidatePath('/assinaturas')
    revalidatePath('/agendamento')

    // ── Push Notification: subscription_closed ──
    try {
      const adminClient2 = getAdminClient()
      const { data: custData } = await adminClient2.from('customers').select('full_name').eq('id', sub.customer_id).single()
      const { data: planData } = await adminClient2.from('subscription_plans').select('display_name').eq('id', sub.plan_id).single()
      let professionalName = 'Profissional'
      if (sub.preferred_professional_id) {
        const { data: prof } = await adminClient2.from('collaborators').select('name, display_name').eq('id', sub.preferred_professional_id).single()
        if (prof) professionalName = prof.display_name || prof.name
      }
      const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
      const notifData = {
        subscriptionId,
        customerName: custData?.full_name || 'Cliente',
        planName: planData?.display_name || 'Assinatura',
        professionalName,
        professionalId: sub.preferred_professional_id,
        dayOfWeek: weekdays[sub.fixed_weekday] || '',
        time: sub.fixed_time || '',
      }
      const targets = [...(await resolveAdminTargets())]
      if (sub.preferred_professional_id) {
        const profTarget = await resolveProfessionalTarget(sub.preferred_professional_id)
        if (profTarget) targets.push(profTarget)
      }
      const payload = buildSubscriptionClosedPayload(notifData, 'admin')
      await dispatchNotification({
        eventType: 'subscription_closed',
        entityType: 'subscription',
        entityId: subscriptionId,
        idempotencyKey: `subscription_closed:${subscriptionId}`,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        targets,
        createdBy: ctx.userProfileId,
      })
    } catch {}

    return { success: true }
  } catch (err: any) {
    console.error('activateSubscription error:', err)
    return { success: false, error: err.message || 'Erro ao ativar assinatura.' }
  }
}

// ══════════════════════════════════════════════════════════
// Generate Subscription Appointments (idempotent)
// ══════════════════════════════════════════════════════════

export async function generateSubscriptionAppointments(subscriptionId: string): Promise<{
  success: boolean
  created?: number
  error?: string
}> {
  try {
    const supabase = getAdminClient()

    // Fetch subscription with plan and customer
    const { data: sub, error: subErr } = await supabase
      .from('customer_subscriptions')
      .select('*, subscription_plans(*), customers(*)')
      .eq('id', subscriptionId)
      .single()

    if (subErr || !sub) {
      return { success: false, error: 'Assinatura não encontrada.' }
    }

    const plan = (sub as any).subscription_plans as SubscriptionPlanRow | null
    if (!plan) return { success: false, error: 'Plano não encontrado.' }
    const customer = (sub as any).customers

    const isCustomized = sub.is_customized
    const durationMin = isCustomized && sub.duration_minutes_snapshot ? sub.duration_minutes_snapshot : plan.duration_minutes_per_visit
    const visitsCount = isCustomized && sub.visits_per_cycle_snapshot ? sub.visits_per_cycle_snapshot : plan.visits_per_cycle
    const planName = isCustomized && sub.custom_plan_name ? sub.custom_plan_name : plan.display_name

    // Check existing occurrences to avoid duplicates
    const { data: existingOccs } = await supabase
      .from('subscription_occurrences')
      .select('occurrence_index, occurrence_date')
      .eq('subscription_id', subscriptionId)
      .in('status', ['scheduled', 'used'])

    const existingIndexes = new Set((existingOccs || []).map((o: any) => o.occurrence_index))

    // If all occurrences already exist, skip (idempotent)
    if (existingIndexes.size >= visitsCount) {
      return { success: true, created: 0 }
    }

    // Get visit template
    const visitTemplate: VisitTemplateEntry[] = isCustomized && Array.isArray(sub.custom_services_snapshot)
      ? Array.from({ length: visitsCount }).map((_, idx) => ({ index: idx, items: sub.custom_services_snapshot }))
      : (Array.isArray(plan.visit_template_json) ? plan.visit_template_json as VisitTemplateEntry[] : [])

    // Generate occurrence dates
    const today = new Date()
    let nextDate = new Date(today)
    while (nextDate.getDay() !== sub.fixed_weekday) {
      nextDate.setDate(nextDate.getDate() + 1)
    }

    const [hh, mm] = (sub.fixed_time || '09:00').split(':').map(Number)

    let created = 0
    for (let i = 0; i < visitsCount; i++) {
      const occIndex = i + 1

      // Skip if already exists
      if (existingIndexes.has(occIndex)) {
        nextDate.setDate(nextDate.getDate() + 7)
        continue
      }

      const dateStr = nextDate.toISOString().split('T')[0]
      const startAt = `${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00-03:00`
      const endAt = new Date(new Date(startAt).getTime() + durationMin * 60000).toISOString()

      // Get template items for this visit
      const templateEntry = visitTemplate[i]
      const templateItems = templateEntry?.items || []
      const visitLabel = templateItems.length > 0
        ? `Visita ${occIndex}: ${templateItems.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' + ')}`
        : `Visita ${occIndex}`

      // Create appointment
      // source = 'customer' (enum doesn't support 'subscription')
      // is_subscription = true to distinguish
      // service_price_snapshot = 0 to avoid duplicating revenue in caixa/comissão
      const { data: appointment, error: apptErr } = await supabase
        .from('appointments')
        .insert({
          customer_id: sub.customer_id,
          customer_name_snapshot: customer?.full_name || 'Cliente',
          customer_phone_snapshot: customer?.phone || null,
          professional_id: sub.preferred_professional_id,
          service_id: plan.source_service_id,
          service_name_snapshot: `${planName} — ${visitLabel}`,
          service_price_snapshot: 0,
          service_duration_minutes_snapshot: durationMin,
          start_at: startAt,
          end_at: endAt,
          status: 'scheduled',
          source: 'customer',
          is_subscription: true,
          subscription_id: subscriptionId,
          notes: `Assinatura: ${planName} (${visitLabel})`,
        })
        .select('id')
        .single()

      if (apptErr) {
        console.error(`Failed to create appointment for occurrence ${occIndex}:`, apptErr)
        continue
      }

      // Create occurrence record
      await supabase.from('subscription_occurrences').insert({
        subscription_id: subscriptionId,
        appointment_id: appointment?.id || null,
        occurrence_date: dateStr,
        occurrence_start_at: startAt,
        occurrence_end_at: endAt,
        occurrence_index: occIndex,
        status: 'scheduled',
        template_items_json: templateItems,
        visit_label: visitLabel,
      })

      // Link occurrence to appointment
      if (appointment?.id) {
        const { data: occData } = await supabase
          .from('subscription_occurrences')
          .select('id')
          .eq('subscription_id', subscriptionId)
          .eq('occurrence_index', occIndex)
          .single()

        if (occData) {
          await supabase
            .from('appointments')
            .update({ subscription_occurrence_id: occData.id })
            .eq('id', appointment.id)
        }
      }

      created++
      nextDate.setDate(nextDate.getDate() + 7)
    }

    return { success: true, created }
  } catch (err: any) {
    console.error('generateSubscriptionAppointments error:', err)
    return { success: false, error: err.message || 'Erro ao gerar agendamentos.' }
  }
}

// ══════════════════════════════════════════════════════════
// ADMIN: Cancel Subscription
// ══════════════════════════════════════════════════════════

export async function cancelCustomerSubscription(
  subscriptionId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    if (!ctx.hasAdminAccess) {
      return { success: false, error: 'Apenas administradores podem cancelar assinaturas.' }
    }

    const adminClient = getAdminClient()

    const { data: sub, error: fetchErr } = await adminClient
      .from('customer_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single()

    if (fetchErr || !sub) {
      return { success: false, error: 'Assinatura não encontrada.' }
    }

    if (sub.status === 'cancelled') {
      return { success: false, error: 'Assinatura já está cancelada.' }
    }

    const now = new Date().toISOString()

    // Cancel subscription
    const { error: updateErr } = await adminClient
      .from('customer_subscriptions')
      .update({
        status: 'cancelled' as SubscriptionStatus,
        cancelled_at: now,
        cancellation_reason: reason,
        ends_at: now,
        updated_at: now,
      })
      .eq('id', subscriptionId)

    if (updateErr) throw updateErr

    // Cancel future scheduled occurrences
    await adminClient
      .from('subscription_occurrences')
      .update({ status: 'cancelled' })
      .eq('subscription_id', subscriptionId)
      .eq('status', 'scheduled')

    // Cancel future scheduled appointments
    const { data: futureOccs } = await adminClient
      .from('subscription_occurrences')
      .select('appointment_id')
      .eq('subscription_id', subscriptionId)
      .not('appointment_id', 'is', null)

    if (futureOccs && futureOccs.length > 0) {
      const apptIds = futureOccs.map((o: any) => o.appointment_id).filter(Boolean)
      if (apptIds.length > 0) {
        await adminClient
          .from('appointments')
          .update({ status: 'cancelled', cancelled_at: now, cancellation_reason: 'Assinatura cancelada' })
          .in('id', apptIds)
          .eq('status', 'scheduled')
      }
    }

    await logAudit({
      action: 'UPDATE',
      entity: 'customer_subscriptions',
      entity_id: subscriptionId,
      oldData: sub,
      newData: { status: 'cancelled', cancelled_at: now, cancellation_reason: reason },
      observation: `Assinatura cancelada. Motivo: ${reason}`,
    })

    revalidatePath('/assinaturas')
    revalidatePath('/agendamento')

    // ── Push Notification: subscription_cancelled ──
    try {
      const { data: custData } = await adminClient.from('customers').select('full_name').eq('id', sub.customer_id).single()
      const { data: planData } = await adminClient.from('subscription_plans').select('display_name').eq('id', sub.plan_id).single()
      const notifData = {
        subscriptionId,
        customerName: custData?.full_name || 'Cliente',
        planName: planData?.display_name || 'Assinatura',
      }
      const targets = [...(await resolveAdminTargets())]
      if (sub.preferred_professional_id) {
        const profTarget = await resolveProfessionalTarget(sub.preferred_professional_id)
        if (profTarget) targets.push(profTarget)
      }
      const payload = buildSubscriptionCancelledPayload(notifData, 'admin')
      await dispatchNotification({
        eventType: 'subscription_cancelled',
        entityType: 'subscription',
        entityId: subscriptionId,
        idempotencyKey: `subscription_cancelled:${subscriptionId}:${now}`,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        targets,
        createdBy: ctx.userProfileId,
      })
    } catch {}

    return { success: true }
  } catch (err: any) {
    console.error('cancelCustomerSubscription error:', err)
    return { success: false, error: err.message || 'Erro ao cancelar assinatura.' }
  }
}

// ══════════════════════════════════════════════════════════
// Get Customer Active Subscription
// ══════════════════════════════════════════════════════════

export async function getCustomerActiveSubscription(customerId: string): Promise<{
  success: boolean
  data?: CustomerSubscriptionRow | null
  error?: string
}> {
  try {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from('customer_subscriptions')
      .select('*')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      return { success: false, error: 'Erro ao consultar assinatura.' }
    }

    return { success: true, data: data || null }
  } catch (err: any) {
    console.error('getCustomerActiveSubscription error:', err)
    return { success: false, error: 'Erro interno.' }
  }
}

// ══════════════════════════════════════════════════════════
// Mark Occurrence as Used (idempotent)
// ══════════════════════════════════════════════════════════

export async function markOccurrenceUsed(
  occurrenceId: string,
  appointmentId: string,
  consumedBy: 'checked_in' | 'completed' = 'completed'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getAdminClient()

    const { data: occ, error: fetchErr } = await supabase
      .from('subscription_occurrences')
      .select('*')
      .eq('id', occurrenceId)
      .single()

    if (fetchErr || !occ) {
      return { success: false, error: 'Ocorrência não encontrada.' }
    }

    // Idempotent: if already used, do nothing
    if (occ.status === 'used') {
      return { success: true }
    }

    const { error: updateErr } = await supabase
      .from('subscription_occurrences')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        appointment_id: appointmentId,
        consumed_by_status: consumedBy,
      })
      .eq('id', occurrenceId)

    if (updateErr) throw updateErr

    return { success: true }
  } catch (err: any) {
    console.error('markOccurrenceUsed error:', err)
    return { success: false, error: 'Erro ao marcar ocorrência.' }
  }
}

// ══════════════════════════════════════════════════════════
// ADMIN: Mark Occurrence Used Manually
// ══════════════════════════════════════════════════════════

export async function markOccurrenceUsedManually(
  occurrenceId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    if (!ctx.hasAdminAccess) {
      return { success: false, error: 'Sem permissão.' }
    }

    const adminClient = getAdminClient()

    const { data: occ } = await adminClient
      .from('subscription_occurrences')
      .select('*')
      .eq('id', occurrenceId)
      .single()

    if (!occ) return { success: false, error: 'Ocorrência não encontrada.' }
    if (occ.status === 'used') return { success: false, error: 'Visita já foi utilizada.' }

    await adminClient
      .from('subscription_occurrences')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        used_by: ctx.userProfileId,
        consumed_by_status: 'manual',
        notes: reason,
      })
      .eq('id', occurrenceId)

    await logAudit({
      action: 'UPDATE',
      entity: 'subscription_occurrences',
      entity_id: occurrenceId,
      oldData: occ,
      newData: { status: 'used', consumed_by_status: 'manual' },
      observation: `Visita marcada como usada manualmente. Motivo: ${reason}`,
    })

    revalidatePath('/assinaturas')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro.' }
  }
}

// ══════════════════════════════════════════════════════════
// ADMIN: Revert Occurrence Usage (owner/admin only)
// ══════════════════════════════════════════════════════════

export async function revertOccurrenceUsage(
  occurrenceId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    if (!ctx.hasAdminAccess) {
      return { success: false, error: 'Sem permissão.' }
    }

    if (!reason || reason.trim().length < 3) {
      return { success: false, error: 'Motivo obrigatório para reverter consumo.' }
    }

    const adminClient = getAdminClient()

    const { data: occ } = await adminClient
      .from('subscription_occurrences')
      .select('*')
      .eq('id', occurrenceId)
      .single()

    if (!occ) return { success: false, error: 'Ocorrência não encontrada.' }
    if (occ.status !== 'used') return { success: false, error: 'Visita não está marcada como usada.' }

    await adminClient
      .from('subscription_occurrences')
      .update({
        status: 'scheduled',
        used_at: null,
        used_by: null,
        consumed_by_status: null,
        notes: `Revertido: ${reason}`,
      })
      .eq('id', occurrenceId)

    await logAudit({
      action: 'UPDATE',
      entity: 'subscription_occurrences',
      entity_id: occurrenceId,
      oldData: occ,
      newData: { status: 'scheduled', reverted_by: ctx.userProfileId },
      observation: `Consumo de visita revertido por admin. Motivo: ${reason}`,
    })

    revalidatePath('/assinaturas')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro.' }
  }
}

// ══════════════════════════════════════════════════════════
// ADMIN: Register Subscription Payment
// ══════════════════════════════════════════════════════════

export async function registerSubscriptionPayment(input: {
  subscriptionId: string
  amount: number
  paymentMethod: string
  status: 'paid' | 'pending' | 'waived'
  notes?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    if (!ctx.hasAdminAccess) {
      return { success: false, error: 'Sem permissão.' }
    }

    const adminClient = getAdminClient()

    const { data: sub } = await adminClient
      .from('customer_subscriptions')
      .select('customer_id, billing_day, preferred_professional_id')
      .eq('id', input.subscriptionId)
      .single()

    if (!sub) return { success: false, error: 'Assinatura não encontrada.' }

    const now = new Date()

    await adminClient.from('subscription_payments').insert({
      subscription_id: input.subscriptionId,
      customer_id: sub.customer_id,
      professional_id: sub.preferred_professional_id,
      provider: 'manual',
      amount: input.amount,
      status: input.status,
      payment_method: input.paymentMethod,
      paid_at: input.status === 'paid' ? now.toISOString() : null,
      due_at: sub.billing_day
        ? new Date(now.getFullYear(), now.getMonth(), sub.billing_day).toISOString()
        : null,
      raw_event: input.notes ? { admin_notes: input.notes } : null,
    })

    // ── Integration with caixa: register when PAID ──
    if (input.status === 'paid' && input.amount > 0) {
      // Fetch plan and customer info for description
      const { data: subFull } = await adminClient
        .from('customer_subscriptions')
        .select('subscription_plans(display_name), customers(full_name)')
        .eq('id', input.subscriptionId)
        .single()

      await registerPaymentInCashRegister(adminClient, {
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        customerName: (subFull as any)?.customers?.full_name || 'Cliente',
        planName: (subFull as any)?.subscription_plans?.display_name || 'Assinatura',
        subscriptionId: input.subscriptionId,
        operatorId: ctx.userProfileId,
      })
    }

    await logAudit({
      action: 'INSERT',
      entity: 'subscription_payments',
      entity_id: input.subscriptionId,
      newData: {
        amount: input.amount,
        payment_method: input.paymentMethod,
        status: input.status,
        notes: input.notes,
      },
      observation: `Pagamento de assinatura registrado manualmente. R$ ${input.amount.toFixed(2)} via ${input.paymentMethod}.`,
    })

    revalidatePath('/assinaturas')
    revalidatePath('/caixa')
    revalidatePath('/fluxo-de-caixa')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao registrar pagamento.' }
  }
}

// ══════════════════════════════════════════════════════════
// ADMIN: Update Subscription Schedule
// ══════════════════════════════════════════════════════════

export async function updateSubscriptionSchedule(input: {
  subscriptionId: string
  fixedWeekday?: number
  fixedTime?: string
  billingDay?: number
  notes?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)
    if (!ctx.hasAdminAccess) return { success: false, error: 'Sem permissão.' }

    const adminClient = getAdminClient()
    const { data: sub } = await adminClient
      .from('customer_subscriptions')
      .select('*')
      .eq('id', input.subscriptionId)
      .single()

    if (!sub) return { success: false, error: 'Assinatura não encontrada.' }

    const updateData: any = { updated_at: new Date().toISOString() }
    if (input.fixedWeekday !== undefined) updateData.fixed_weekday = input.fixedWeekday
    if (input.fixedTime !== undefined) updateData.fixed_time = input.fixedTime
    if (input.billingDay !== undefined) updateData.billing_day = input.billingDay
    if (input.notes !== undefined) updateData.notes = input.notes

    await adminClient
      .from('customer_subscriptions')
      .update(updateData)
      .eq('id', input.subscriptionId)

    await logAudit({
      action: 'UPDATE',
      entity: 'customer_subscriptions',
      entity_id: input.subscriptionId,
      oldData: sub,
      newData: updateData,
      observation: 'Dados da assinatura atualizados pelo admin.',
    })

    revalidatePath('/assinaturas')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro.' }
  }
}

// ══════════════════════════════════════════════════════════
// ADMIN: Search Customers for Subscription
// ══════════════════════════════════════════════════════════

export async function searchCustomersForSubscription(term: string): Promise<{
  success: boolean
  data?: Array<{ id: string; full_name: string; phone: string | null; email: string | null }>
  error?: string
}> {
  try {
    const adminClient = getAdminClient()

    if (!term || term.length < 2) {
      return { success: true, data: [] }
    }

    const { data, error } = await adminClient
      .from('customers')
      .select('id, full_name, phone, email')
      .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
      .order('full_name')
      .limit(15)

    if (error) return { success: false, error: 'Erro ao buscar clientes.' }
    return { success: true, data: data || [] }
  } catch (err: any) {
    return { success: false, error: 'Erro interno.' }
  }
}

// ══════════════════════════════════════════════════════════
// ADMIN: Create Quick Customer
// ══════════════════════════════════════════════════════════

export async function createQuickCustomer(input: {
  fullName: string
  phone: string
  email?: string
}): Promise<{ success: boolean; customerId?: string; error?: string }> {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    if (!ctx.hasAdminAccess) {
      return { success: false, error: 'Sem permissão.' }
    }

    if (!input.fullName.trim()) return { success: false, error: 'Nome é obrigatório.' }
    if (!input.phone.trim()) return { success: false, error: 'Telefone é obrigatório.' }

    const adminClient = getAdminClient()

    // Check for duplicate phone
    const { data: existing } = await adminClient
      .from('customers')
      .select('id, full_name')
      .eq('phone', input.phone.trim())
      .maybeSingle()

    if (existing) {
      return { success: false, error: `Já existe o cliente "${existing.full_name}" com este telefone.` }
    }

    const { data: customer, error } = await adminClient
      .from('customers')
      .insert({
        full_name: input.fullName.trim(),
        phone: input.phone.trim(),
        email: input.email?.trim() || null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('createQuickCustomer error:', error)
      return { success: false, error: 'Erro ao criar cliente.' }
    }

    await logAudit({
      action: 'INSERT',
      entity: 'customers',
      entity_id: customer.id,
      newData: { full_name: input.fullName, phone: input.phone },
      observation: 'Cliente criado via fluxo de assinatura interna.',
    })

    return { success: true, customerId: customer.id }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao criar cliente.' }
  }
}

// ══════════════════════════════════════════════════════════
// Usage Summary Helper
// ══════════════════════════════════════════════════════════

export async function getSubscriptionUsageSummary(subscriptionId: string): Promise<{
  success: boolean
  data?: SubscriptionUsageSummary
  error?: string
}> {
  try {
    const adminClient = getAdminClient()

    const { data: sub } = await adminClient
      .from('customer_subscriptions')
      .select('plan_id, subscription_plans(visits_per_cycle)')
      .eq('id', subscriptionId)
      .single()

    if (!sub) return { success: false, error: 'Assinatura não encontrada.' }

    const visitsPerCycle = (sub as any).subscription_plans?.visits_per_cycle || 0

    const { data: occs } = await adminClient
      .from('subscription_occurrences')
      .select('occurrence_index, status')
      .eq('subscription_id', subscriptionId)
      .order('occurrence_index', { ascending: true })

    const allOccs = occs || []
    const used = allOccs.filter((o: any) => o.status === 'used').length
    const remaining = visitsPerCycle - used
    const nextOcc = allOccs.find((o: any) => o.status === 'scheduled')
    const nextOccurrenceIndex = nextOcc ? nextOcc.occurrence_index : null
    const isComplete = used >= visitsPerCycle

    return {
      success: true,
      data: {
        visitsPerCycle,
        used,
        remaining: Math.max(0, remaining),
        nextOccurrenceIndex,
        label: `${used}/${visitsPerCycle} usadas`,
        nextLabel: isComplete
          ? 'Ciclo completo'
          : nextOccurrenceIndex
            ? `Próxima: ${nextOccurrenceIndex}/${visitsPerCycle}`
            : 'Sem próxima',
        isComplete,
      },
    }
  } catch (err: any) {
    return { success: false, error: 'Erro.' }
  }
}

// ══════════════════════════════════════════════════════════
// Subscriber Discount (backend SOURCE OF TRUTH)
// ══════════════════════════════════════════════════════════

export async function getSubscriberDiscount(customerId: string): Promise<{
  hasDiscount: boolean
  discountPercent: number
  subscriptionId?: string
}> {
  try {
    const supabase = getAdminClient()
    const today = new Date().toISOString().split('T')[0]

    const { data: sub } = await supabase
      .from('customer_subscriptions')
      .select('id, subscriber_discount_percent, current_period_end, status')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .gte('current_period_end', today)
      .single()

    if (!sub) {
      return { hasDiscount: false, discountPercent: 0 }
    }

    return {
      hasDiscount: true,
      discountPercent: sub.subscriber_discount_percent || 7,
      subscriptionId: sub.id,
    }
  } catch {
    return { hasDiscount: false, discountPercent: 0 }
  }
}

// Discount utility functions moved to features/subscriptions/utils/discount.ts
// (Pure functions cannot be exported from "use server" files)

// ══════════════════════════════════════════════════════════
// ADMIN: List All Subscriptions (with advanced filters)
// ══════════════════════════════════════════════════════════

export async function listSubscriptions(filters?: {
  status?: SubscriptionStatus
  professionalId?: string
  planId?: string
  weekday?: number
  billingDay?: number
}): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)
    if (!ctx.hasAdminAccess) {
      return { success: false, error: 'Sem permissão.' }
    }

    const adminClient = getAdminClient()
    let query = adminClient
      .from('customer_subscriptions')
      .select(`
        *,
        subscription_plans(id, name, display_name, monthly_price, visits_per_cycle, duration_minutes_per_visit),
        customers(id, full_name, phone, email),
        subscription_occurrences(id, occurrence_index, status, occurrence_date, visit_label, used_at)
      `)
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.professionalId) {
      query = query.eq('preferred_professional_id', filters.professionalId)
    }
    if (filters?.planId) {
      query = query.eq('plan_id', filters.planId)
    }
    if (filters?.weekday !== undefined) {
      query = query.eq('fixed_weekday', filters.weekday)
    }
    if (filters?.billingDay !== undefined) {
      query = query.eq('billing_day', filters.billingDay)
    }

    const { data, error } = await query

    if (error) {
      console.error('listSubscriptions error:', error)
      return { success: false, error: 'Erro ao listar assinaturas.' }
    }

    // Enrich with professional name and usage summary
    const enriched = []
    for (const sub of (data || [])) {
      // Fetch professional name
      let professionalName = null
      if (sub.preferred_professional_id) {
        const { data: prof } = await adminClient
          .from('collaborators')
          .select('name, display_name')
          .eq('id', sub.preferred_professional_id)
          .single()
        if (prof) professionalName = prof.display_name || prof.name
      }

      // Calculate usage from occurrences
      const occs = sub.subscription_occurrences || []
      const visitsPerCycle = sub.subscription_plans?.visits_per_cycle || 0
      const used = occs.filter((o: any) => o.status === 'used').length
      const nextOcc = occs
        .filter((o: any) => o.status === 'scheduled')
        .sort((a: any, b: any) => a.occurrence_index - b.occurrence_index)[0]

      enriched.push({
        ...sub,
        professional_name: professionalName,
        usage: {
          visitsPerCycle,
          used,
          remaining: Math.max(0, visitsPerCycle - used),
          nextOccurrenceDate: nextOcc?.occurrence_date || null,
          label: `${used}/${visitsPerCycle}`,
        },
      })
    }

    return { success: true, data: enriched }
  } catch (err: any) {
    console.error('listSubscriptions error:', err)
    return { success: false, error: 'Erro interno.' }
  }
}

// ══════════════════════════════════════════════════════════
// ADMIN: Get Subscription Details (with occurrences)
// ══════════════════════════════════════════════════════════

export async function getSubscriptionDetails(subscriptionId: string): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)
    if (!ctx.hasAdminAccess) {
      return { success: false, error: 'Sem permissão.' }
    }

    const adminClient = getAdminClient()
    const { data: sub, error } = await adminClient
      .from('customer_subscriptions')
      .select(`
        *,
        subscription_plans(*, subscription_plan_professionals(professional_id, collaborators(id, name, display_name))),
        customers(id, full_name, phone, email, cpf),
        subscription_occurrences(*)
      `)
      .eq('id', subscriptionId)
      .single()

    if (error || !sub) {
      return { success: false, error: 'Assinatura não encontrada.' }
    }

    // Fetch professional name
    let professionalName = null
    let professionalDisplayName = null
    if (sub.preferred_professional_id) {
      const { data: prof } = await adminClient
        .from('collaborators')
        .select('name, display_name')
        .eq('id', sub.preferred_professional_id)
        .single()
      if (prof) {
        professionalName = prof.name
        professionalDisplayName = prof.display_name || prof.name
      }
    }

    // Fetch payments
    const { data: payments } = await adminClient
      .from('subscription_payments')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('created_at', { ascending: false })

    // Calculate usage
    const occs = (sub as any).subscription_occurrences || []
    const visitsPerCycle = (sub as any).subscription_plans?.visits_per_cycle || 0
    const usedCount = occs.filter((o: any) => o.status === 'used').length
    const nextOcc = occs
      .filter((o: any) => o.status === 'scheduled')
      .sort((a: any, b: any) => a.occurrence_index - b.occurrence_index)[0]

    return {
      success: true,
      data: {
        ...(sub as any),
        professional_name: professionalDisplayName,
        payments: payments || [],
        usage: {
          visitsPerCycle,
          used: usedCount,
          remaining: Math.max(0, visitsPerCycle - usedCount),
          nextOccurrenceIndex: nextOcc?.occurrence_index || null,
          label: `${usedCount}/${visitsPerCycle} usadas`,
          nextLabel: usedCount >= visitsPerCycle
            ? 'Ciclo completo'
            : nextOcc
              ? `Próxima: ${nextOcc.occurrence_index}/${visitsPerCycle}`
              : 'Sem próxima',
          isComplete: usedCount >= visitsPerCycle,
        },
      },
    }
  } catch (err: any) {
    console.error('getSubscriptionDetails error:', err)
    return { success: false, error: 'Erro interno.' }
  }
}
