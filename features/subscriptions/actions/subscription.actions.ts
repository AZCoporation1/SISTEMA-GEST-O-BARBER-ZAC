"use server"

/**
 * Barber Zac ERP — Subscription Actions
 *
 * Server actions for the monthly subscription module.
 * Handles plan retrieval, availability checking, subscription lifecycle,
 * occurrence tracking, and subscriber discount logic.
 *
 * Rules:
 * - Backend is SOURCE OF TRUTH for all prices, discounts, and status
 * - Appointments use service_price_snapshot=0 to avoid duplicating revenue
 * - Activation only via admin manual or approved payment
 * - Idempotent: no duplicate occurrences/appointments
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
// PUBLIC: Create Subscription Draft
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
    const now = new Date()
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

    // Fetch subscription with plan
    const { data: sub, error: subErr } = await supabase
      .from('customer_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('id', subscriptionId)
      .single()

    if (subErr || !sub) {
      return { success: false, error: 'Assinatura não encontrada.' }
    }

    const plan = (sub as any).subscription_plans as SubscriptionPlanRow | null
    if (!plan) return { success: false, error: 'Plano não encontrado.' }

    // Check existing occurrences to avoid duplicates
    const { data: existingOccs } = await supabase
      .from('subscription_occurrences')
      .select('occurrence_index, occurrence_date')
      .eq('subscription_id', subscriptionId)
      .in('status', ['scheduled', 'used'])

    const existingIndexes = new Set((existingOccs || []).map((o: any) => o.occurrence_index))

    // If all occurrences already exist, skip (idempotent)
    if (existingIndexes.size >= plan.visits_per_cycle) {
      return { success: true, created: 0 }
    }

    // Get visit template
    const visitTemplate: VisitTemplateEntry[] = Array.isArray(plan.visit_template_json)
      ? plan.visit_template_json as VisitTemplateEntry[]
      : []

    // Generate occurrence dates
    const today = new Date()
    let nextDate = new Date(today)
    while (nextDate.getDay() !== sub.fixed_weekday) {
      nextDate.setDate(nextDate.getDate() + 1)
    }

    const [hh, mm] = (sub.fixed_time || '09:00').split(':').map(Number)
    // Duration is always from the plan (service original duration)
    const durationMin = plan.duration_minutes_per_visit

    let created = 0
    for (let i = 0; i < plan.visits_per_cycle; i++) {
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
          professional_id: sub.preferred_professional_id,
          service_id: plan.source_service_id,
          service_name_snapshot: `${plan.display_name} — ${visitLabel}`,
          service_price_snapshot: 0,
          service_duration_minutes_snapshot: durationMin,
          start_at: startAt,
          end_at: endAt,
          status: 'scheduled',
          source: 'customer',
          is_subscription: true,
          subscription_id: subscriptionId,
          notes: `Assinatura: ${plan.display_name} (${visitLabel})`,
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
// ADMIN: List All Subscriptions
// ══════════════════════════════════════════════════════════

export async function listSubscriptions(filters?: {
  status?: SubscriptionStatus
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
        subscription_plans(id, name, display_name, monthly_price, visits_per_cycle),
        customers(id, full_name, phone, email)
      `)
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    const { data, error } = await query

    if (error) {
      console.error('listSubscriptions error:', error)
      return { success: false, error: 'Erro ao listar assinaturas.' }
    }

    return { success: true, data: data || [] }
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

    // Fetch payments
    const { data: payments } = await adminClient
      .from('subscription_payments')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('created_at', { ascending: false })

    return { success: true, data: { ...(sub as any), payments: payments || [] } }
  } catch (err: any) {
    console.error('getSubscriptionDetails error:', err)
    return { success: false, error: 'Erro interno.' }
  }
}
