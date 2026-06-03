// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { appointmentSchema, blockSchema, agendaSettingsSchema, waitlistSchema, type AppointmentFormValues, type BlockFormValues, type AgendaSettingsFormValues, type WaitlistFormValues } from "../validators"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"
import { dispatchNotification, resolveAdminTargets, resolveProfessionalTarget } from "@/features/notifications/services/notificationRouter.service"
import { buildAppointmentCreatedPayload, buildAppointmentCancelledPayload, buildAppointmentRescheduledPayload, buildAppointmentCheckinPayload, buildAppointmentCompletedPayload, buildAppointmentNoShowPayload } from "@/features/notifications/services/eventPayloads"
import { processSale } from "@/features/sales/actions/sales.actions"
import { markOccurrenceUsed } from "@/features/subscriptions/actions/subscription.actions"
import { calculateServiceComposition, validateCompositionCompatibility } from "../services/service-composition"
import type { CompositionServiceInput } from "../services/service-composition"
import { revalidatePath } from "next/cache"
import type { SaleFormValues } from "@/features/sales/validators"

// ── Helpers ─────────────────────────────────────────────

async function getUserContext(supabase: any) {
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData.user?.id
  const userProfileId = await resolveUserProfileId(supabase, userId)

  // Fetch system role for permission checks
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

function buildSaoPauloDateTime(dateYmd: string, timeHHmm: string): Date {
  return new Date(`${dateYmd}T${timeHHmm}:00-03:00`)
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

// ══════════════════════════════════════════════════════════
// CREATE APPOINTMENT
// ══════════════════════════════════════════════════════════

export async function createAppointment(data: AppointmentFormValues) {
  try {
    const validated = appointmentSchema.parse(data)
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    // ── Permission: professional can only create for themselves ──
    if (!ctx.hasAdminAccess) {
      if (ctx.collaboratorId && validated.professional_id !== ctx.collaboratorId) {
        return { success: false, error: "Você só pode criar agendamentos para sua própria agenda." }
      }
    }

    // ── Resolve service snapshot ──
    let serviceSnapshot: any = {}
    if (validated.service_id) {
      const { data: svc } = await supabase
        .from('services')
        .select('id, name, price, duration_minutes, commission_percent')
        .eq('id', validated.service_id)
        .single()
      if (svc) {
        serviceSnapshot = {
          service_name_snapshot: svc.name,
          service_price_snapshot: svc.price,
          service_duration_minutes_snapshot: svc.duration_minutes,
        }
        // Use service duration if not overridden
        if (!data.duration_minutes || data.duration_minutes === 30) {
          validated.duration_minutes = svc.duration_minutes
        }
      }
    }

    // ── Calculate start/end times ──
    const startAtDate = buildSaoPauloDateTime(validated.start_date, validated.start_time)
    const endAtDate = addMinutes(startAtDate, validated.duration_minutes)
    const startAt = startAtDate.toISOString()
    const endAt = endAtDate.toISOString()

    // ── Conflict check ──
    const { data: conflicts } = await supabase
      .from('appointments')
      .select('id, start_at, end_at, status')
      .eq('professional_id', validated.professional_id)
      .not('status', 'in', '("cancelled","no_show")')
      .lt('start_at', endAt)
      .gt('end_at', startAt)

    if (conflicts && conflicts.length > 0) {
      // Check if overbooking is allowed
      const { data: settings } = await supabase.from('agenda_settings').select('allow_overbooking').limit(1).single()
      if (!settings?.allow_overbooking) {
        return { success: false, error: "Conflito de horário: já existe agendamento para este profissional neste horário." }
      }
    }

    // ── Block check ──
    const { data: blocks } = await supabase
      .from('appointment_blocks')
      .select('id')
      .eq('professional_id', validated.professional_id)
      .eq('is_active', true)
      .lt('start_at', endAt)
      .gt('end_at', startAt)

    if (blocks && blocks.length > 0) {
      return { success: false, error: "Horário bloqueado para este profissional." }
    }

    // ── Resolve customer snapshot ──
    let customerSnapshot: any = { customer_name_snapshot: validated.customer_name }
    if (validated.customer_id) {
      const { data: cust } = await supabase
        .from('customers')
        .select('full_name, phone, mobile_phone')
        .eq('id', validated.customer_id)
        .single()
      if (cust) {
        customerSnapshot = {
          customer_name_snapshot: cust.full_name,
          customer_phone_snapshot: cust.phone || cust.mobile_phone,
        }
      }
    } else if (validated.customer_phone) {
      customerSnapshot.customer_phone_snapshot = validated.customer_phone
    }

    // ── Insert appointment ──
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        customer_id: validated.customer_id || null,
        ...customerSnapshot,
        professional_id: validated.professional_id,
        service_id: validated.service_id || null,
        ...serviceSnapshot,
        start_at: startAt,
        end_at: endAt,
        status: validated.status || 'scheduled',
        source: ctx.hasAdminAccess ? 'admin' : 'professional',
        notes: validated.notes || null,
        created_by: ctx.userProfileId,
      })
      .select()
      .single()

    if (error) throw error

    // ── If service exists, also add as command item ──
    if (validated.service_id && serviceSnapshot.service_name_snapshot) {
      await supabase.from('appointment_command_items').insert({
        appointment_id: appointment.id,
        item_type: 'service',
        service_id: validated.service_id,
        description_snapshot: serviceSnapshot.service_name_snapshot,
        quantity: 1,
        unit_price_snapshot: serviceSnapshot.service_price_snapshot || 0,
        professional_id: validated.professional_id,
      })
    }

    await logAudit({
      action: 'INSERT',
      entity: 'appointments',
      entity_id: appointment.id,
      newData: appointment,
      observation: `Agendamento criado: ${customerSnapshot.customer_name_snapshot} — ${serviceSnapshot.service_name_snapshot || 'Sem serviço'} às ${validated.start_time}`,
    })

    revalidatePath("/agendamento")

    // ── Push Notification: appointment_created ──
    try {
      const profName = serviceSnapshot.service_name_snapshot ? undefined : undefined
      // Resolve professional name
      let professionalName = 'Profissional'
      const { data: profData } = await supabase.from('collaborators').select('name, display_name').eq('id', validated.professional_id).single()
      if (profData) professionalName = profData.display_name || profData.name

      const notifData = {
        appointmentId: appointment.id,
        customerName: customerSnapshot.customer_name_snapshot || 'Cliente',
        serviceName: serviceSnapshot.service_name_snapshot || 'Serviço',
        professionalName,
        professionalId: validated.professional_id,
        startTime: validated.start_time,
        startDate: validated.start_date,
      }

      const targets = [...(await resolveAdminTargets())]
      const profTarget = await resolveProfessionalTarget(validated.professional_id)
      if (profTarget) targets.push(profTarget)

      const adminPayload = buildAppointmentCreatedPayload(notifData, 'admin')
      await dispatchNotification({
        eventType: 'appointment_created',
        entityType: 'appointment',
        entityId: appointment.id,
        idempotencyKey: `appointment_created:${appointment.id}`,
        title: adminPayload.title,
        body: adminPayload.body,
        data: adminPayload.data,
        targets,
        createdBy: ctx.userProfileId,
      })
    } catch {}

    return { success: true, data: appointment }
  } catch (err: any) {
    console.error("Create Appointment Error:", err)
    return { success: false, error: err.message || "Erro ao criar agendamento" }
  }
}

// ══════════════════════════════════════════════════════════
// UPDATE APPOINTMENT
// ══════════════════════════════════════════════════════════

export async function updateAppointment(id: string, data: AppointmentFormValues) {
  try {
    const validated = appointmentSchema.parse(data)
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    // Permission check
    if (!ctx.hasAdminAccess) {
      const { data: existing } = await supabase.from('appointments').select('professional_id').eq('id', id).single()
      if (existing && ctx.collaboratorId && existing.professional_id !== ctx.collaboratorId) {
        return { success: false, error: "Você só pode editar seus próprios agendamentos." }
      }
    }

    // Get old data for audit
    const { data: oldData } = await supabase.from('appointments').select('*').eq('id', id).single()

    // Resolve service
    let serviceSnapshot: any = {}
    if (validated.service_id) {
      const { data: svc } = await supabase.from('services').select('id, name, price, duration_minutes').eq('id', validated.service_id).single()
      if (svc) {
        serviceSnapshot = {
          service_name_snapshot: svc.name,
          service_price_snapshot: svc.price,
          service_duration_minutes_snapshot: svc.duration_minutes,
        }
        if (!data.duration_minutes || data.duration_minutes === 30) validated.duration_minutes = svc.duration_minutes
      }
    }

    const startAtDate = buildSaoPauloDateTime(validated.start_date, validated.start_time)
    const endAtDate = addMinutes(startAtDate, validated.duration_minutes)
    const startAt = startAtDate.toISOString()
    const endAt = endAtDate.toISOString()

    // Conflict check (exclude self)
    const { data: conflicts } = await supabase
      .from('appointments')
      .select('id')
      .eq('professional_id', validated.professional_id)
      .not('status', 'in', '("cancelled","no_show")')
      .neq('id', id)
      .lt('start_at', endAt)
      .gt('end_at', startAt)

    if (conflicts && conflicts.length > 0) {
      const { data: settings } = await supabase.from('agenda_settings').select('allow_overbooking').limit(1).single()
      if (!settings?.allow_overbooking) {
        return { success: false, error: "Conflito de horário com outro agendamento." }
      }
    }

    const { data: updated, error } = await supabase
      .from('appointments')
      .update({
        professional_id: validated.professional_id,
        service_id: validated.service_id || null,
        ...serviceSnapshot,
        start_at: startAt,
        end_at: endAt,
        notes: validated.notes || null,
        updated_by: ctx.userProfileId,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    await logAudit({
      action: 'UPDATE',
      entity: 'appointments',
      entity_id: id,
      oldData,
      newData: updated,
      observation: `Agendamento editado`,
    })

    revalidatePath("/agendamento")

    // ── Push Notification: appointment_rescheduled (if time/date changed) ──
    try {
      const oldStartTime = oldData?.start_at ? new Date(oldData.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : ''
      if (oldData && (oldData.start_at !== startAt || oldData.professional_id !== validated.professional_id)) {
        let professionalName = 'Profissional'
        const { data: profData } = await supabase.from('collaborators').select('name, display_name').eq('id', validated.professional_id).single()
        if (profData) professionalName = profData.display_name || profData.name

        const notifData = {
          appointmentId: id,
          customerName: updated?.customer_name_snapshot || oldData?.customer_name_snapshot || 'Cliente',
          serviceName: updated?.service_name_snapshot || oldData?.service_name_snapshot || 'Serviço',
          professionalName,
          professionalId: validated.professional_id,
          startTime: oldStartTime,
          newStartTime: validated.start_time,
          newStartDate: validated.start_date,
        }

        const targets = [...(await resolveAdminTargets())]
        const profTarget = await resolveProfessionalTarget(validated.professional_id)
        if (profTarget) targets.push(profTarget)

        const payload = buildAppointmentRescheduledPayload(notifData, 'admin')
        await dispatchNotification({
          eventType: 'appointment_rescheduled',
          entityType: 'appointment',
          entityId: id,
          idempotencyKey: `appointment_rescheduled:${id}:${new Date().toISOString()}`,
          title: payload.title,
          body: payload.body,
          data: payload.data,
          targets,
          createdBy: ctx.userProfileId,
        })
      }
    } catch {}

    return { success: true, data: updated }
  } catch (err: any) {
    console.error("Update Appointment Error:", err)
    return { success: false, error: err.message || "Erro ao atualizar agendamento" }
  }
}

// ══════════════════════════════════════════════════════════
// CANCEL APPOINTMENT
// ══════════════════════════════════════════════════════════

export async function cancelAppointment(id: string, reason: string) {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    const { data: oldData } = await supabase.from('appointments').select('*').eq('id', id).single()

    const { data: updated, error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_by: ctx.userProfileId,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    await logAudit({
      action: 'UPDATE',
      entity: 'appointments',
      entity_id: id,
      oldData,
      newData: updated,
      observation: `Agendamento cancelado. Motivo: ${reason}`,
    })

    revalidatePath("/agendamento")

    // ── Push Notification: appointment_cancelled ──
    try {
      const notifData = {
        appointmentId: id,
        customerName: oldData?.customer_name_snapshot || 'Cliente',
        serviceName: oldData?.service_name_snapshot || 'Serviço',
        professionalId: oldData?.professional_id,
        startTime: oldData?.start_at ? new Date(oldData.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '',
      }

      const targets = [...(await resolveAdminTargets())]
      if (oldData?.professional_id) {
        const profTarget = await resolveProfessionalTarget(oldData.professional_id)
        if (profTarget) targets.push(profTarget)
      }

      const payload = buildAppointmentCancelledPayload(notifData, 'admin')
      await dispatchNotification({
        eventType: 'appointment_cancelled',
        entityType: 'appointment',
        entityId: id,
        idempotencyKey: `appointment_cancelled:${id}:${new Date().toISOString()}`,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        targets,
        createdBy: ctx.userProfileId,
      })
    } catch {}

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao cancelar agendamento" }
  }
}

// ══════════════════════════════════════════════════════════
// MARK NO-SHOW
// ══════════════════════════════════════════════════════════

export async function markNoShow(id: string) {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    const { data: updated, error } = await supabase
      .from('appointments')
      .update({ status: 'no_show', updated_by: ctx.userProfileId })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    await logAudit({
      action: 'UPDATE',
      entity: 'appointments',
      entity_id: id,
      newData: updated,
      observation: `Ausência registrada`,
    })

    revalidatePath("/agendamento")

    // ── Push Notification: appointment_no_show ──
    try {
      const notifData = {
        appointmentId: id,
        customerName: updated?.customer_name_snapshot || 'Cliente',
        serviceName: updated?.service_name_snapshot || 'Serviço',
        professionalId: updated?.professional_id,
        startTime: updated?.start_at ? new Date(updated.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '',
      }

      const targets = [...(await resolveAdminTargets())]
      if (updated?.professional_id) {
        const profTarget = await resolveProfessionalTarget(updated.professional_id)
        if (profTarget) targets.push(profTarget)
      }

      const payload = buildAppointmentNoShowPayload(notifData, 'admin')
      await dispatchNotification({
        eventType: 'appointment_no_show',
        entityType: 'appointment',
        entityId: id,
        idempotencyKey: `appointment_no_show:${id}`,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        targets,
        createdBy: ctx.userProfileId,
      })
    } catch {}

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao marcar ausência" }
  }
}

// ══════════════════════════════════════════════════════════
// CHECK-IN
// ══════════════════════════════════════════════════════════

export async function checkInAppointment(id: string) {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    const { data: appt } = await supabase.from('appointments').select('is_subscription, subscription_occurrence_id').eq('id', id).single()

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'checked_in', updated_by: ctx.userProfileId })
      .eq('id', id)

    if (error) throw error

    // ── Subscription: consume occurrence on check-in (idempotent) ──
    if (appt?.is_subscription && appt?.subscription_occurrence_id) {
      await markOccurrenceUsed(appt.subscription_occurrence_id, id, 'checked_in')
    }

    await logAudit({
      action: 'UPDATE',
      entity: 'appointments',
      entity_id: id,
      observation: 'Check-in realizado',
    })

    revalidatePath("/agendamento")

    // ── Push Notification: appointment_checkin ──
    try {
      const { data: apptFull } = await supabase.from('appointments').select('customer_name_snapshot, service_name_snapshot, professional_id, start_at').eq('id', id).single()

      const notifData = {
        appointmentId: id,
        customerName: apptFull?.customer_name_snapshot || 'Cliente',
        serviceName: apptFull?.service_name_snapshot || 'Serviço',
        professionalId: apptFull?.professional_id,
        startTime: apptFull?.start_at ? new Date(apptFull.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '',
      }

      const targets = [...(await resolveAdminTargets())]
      if (apptFull?.professional_id) {
        const profTarget = await resolveProfessionalTarget(apptFull.professional_id)
        if (profTarget) targets.push(profTarget)
      }

      const payload = buildAppointmentCheckinPayload(notifData, 'admin')
      await dispatchNotification({
        eventType: 'appointment_checkin',
        entityType: 'appointment',
        entityId: id,
        idempotencyKey: `appointment_checkin:${id}`,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        targets,
        createdBy: ctx.userProfileId,
      })
    } catch {}

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro no check-in" }
  }
}

// ══════════════════════════════════════════════════════════
// CONFIRM APPOINTMENT
// ══════════════════════════════════════════════════════════

export async function confirmAppointment(id: string) {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'confirmed', updated_by: ctx.userProfileId })
      .eq('id', id)

    if (error) throw error

    await logAudit({
      action: 'UPDATE',
      entity: 'appointments',
      entity_id: id,
      observation: 'Agendamento confirmado',
    })

    revalidatePath("/agendamento")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao confirmar" }
  }
}

// ══════════════════════════════════════════════════════════
// COMPLETE APPOINTMENT VIA SALE (processSale integration)
// ══════════════════════════════════════════════════════════

function isPerfumeProduct(product: any): boolean {
  if (!product) return false
  
  const code = String(product.external_code || '').toUpperCase()
  if (code.startsWith('PERF')) return true

  const catName = String(product.category?.name || '').toLowerCase()
  const catSlug = String(product.category?.slug || '').toLowerCase()
  
  if (catName.includes('perfume') || catSlug.includes('perfume') || catName === 'perf' || catSlug === 'perf') {
    return true
  }

  return false
}

export async function completeAppointmentViaSale(
  appointmentId: string,
  saleData: {
    payment_method_id: string
    discount_amount?: number
    items: Array<{
      type: 'product' | 'service'
      productId?: string | null
      serviceId?: string | null
      name: string
      quantity: number
      unitPrice: number
      unitCost: number
      discount?: number
    }>
    notes?: string
    service_price_override?: number
    service_price_adjustment_reason?: string
  }
) {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    if (!ctx.userId) {
      throw new Error("Usuário não autenticado")
    }

    // Fetch appointment
    const { data: appointment, error: fetchErr } = await supabase
      .from('appointments')
      .select('*, professional:collaborators(id, name)')
      .eq('id', appointmentId)
      .single()

    if (fetchErr || !appointment) throw new Error("Agendamento não encontrado")
    if (appointment.status === 'completed') throw new Error("Este atendimento já foi finalizado.")
    if (appointment.status === 'cancelled') throw new Error("Agendamento cancelado")

    // Check if there's already an active sale linked to this appointment
    if (appointment.linked_sale_id) {
      const { data: linkedSale } = await supabase
        .from('sales')
        .select('id, status')
        .eq('id', appointment.linked_sale_id)
        .single()

      if (linkedSale && linkedSale.status !== 'cancelled') {
        throw new Error("Este atendimento já possui uma venda ativa vinculada.")
      }
    }

    // Validate quantities, unit prices, and discount
    if (saleData.discount_amount && saleData.discount_amount < 0) {
      throw new Error("O valor do desconto não pode ser negativo.")
    }

    const itemsTotal = saleData.items.reduce((sum, item) => {
      if (item.unitPrice < 0) throw new Error("Os valores unitários não podem ser negativos.")
      if (item.quantity <= 0) throw new Error("As quantidades devem ser maiores que zero.")
      return sum + (item.quantity * item.unitPrice - (item.discount || 0))
    }, 0)

    const totalFinal = itemsTotal - (saleData.discount_amount || 0)
    if (totalFinal <= 0) {
      throw new Error("O valor total da venda deve ser maior que zero.")
    }

    // Fetch products to validate and get unit costs
    const productIds = saleData.items
      .filter(item => item.type === 'product' && item.productId)
      .map(item => item.productId as string)

    let dbProducts: any[] = []
    if (productIds.length > 0) {
      const { data: prods, error: prodErr } = await supabase
        .from('inventory_products')
        .select(`
          id, name, external_code, is_active, current_qty, cost_price, deleted_at, is_deleted,
          category:category_id (id, name, slug)
        `)
        .in('id', productIds)

      if (prodErr) throw new Error("Erro ao carregar dados do estoque para validação.")
      dbProducts = prods || []
    }

    // Validate products and check for perfumes
    for (const item of saleData.items) {
      if (item.type === 'product' && item.productId) {
        const dbProd = dbProducts.find(p => p.id === item.productId)
        if (!dbProd) {
          throw new Error(`Produto "${item.name}" não encontrado no estoque.`)
        }
        if (!dbProd.is_active) {
          throw new Error(`Produto "${item.name}" não está ativo.`)
        }
        if (dbProd.deleted_at || dbProd.is_deleted) {
          throw new Error(`Produto "${item.name}" foi excluído.`)
        }
        if (isPerfumeProduct(dbProd)) {
          throw new Error("Perfumes possuem fluxo próprio de venda e não podem ser adicionados por esta comanda.")
        }
        if (dbProd.current_qty < item.quantity) {
          throw new Error(`Estoque insuficiente para o produto "${item.name}". Disponível: ${dbProd.current_qty}, Solicitado: ${item.quantity}.`)
        }
      }
    }

    // Price adjustment calculations
    const originalPrice = appointment.service_price_snapshot || 0
    // Find the main service item in the sale items to get the charged price
    const mainServiceItem = saleData.items.find(
      item => item.type === 'service' && item.serviceId === appointment.service_id
    )
    const chargedPrice = mainServiceItem ? mainServiceItem.unitPrice : originalPrice
    const isPriceAdjusted = mainServiceItem ? (chargedPrice !== originalPrice) : false

    let diffPercent = 0
    if (originalPrice > 0) {
      diffPercent = (Math.abs(chargedPrice - originalPrice) / originalPrice) * 100
    } else if (chargedPrice > 0) {
      diffPercent = 100
    }

    if (isPriceAdjusted && diffPercent > 20) {
      if (!saleData.service_price_adjustment_reason || !saleData.service_price_adjustment_reason.trim()) {
        throw new Error("Motivo do ajuste é obrigatório para diferenças maiores que 20%.")
      }
    }

    // Build Sale Notes
    let saleNotes = saleData.notes || `Comanda do agendamento ${appointmentId.split('-')[0]}`
    if (isPriceAdjusted) {
      const adjustmentAmount = chargedPrice - originalPrice
      const adjustmentPercent = diffPercent
      saleNotes += `\n[Ajuste de Preço do Serviço: R$ ${originalPrice.toFixed(2)} -> R$ ${chargedPrice.toFixed(2)} (${adjustmentAmount >= 0 ? '+' : ''}${adjustmentPercent.toFixed(1)}%). Motivo: ${saleData.service_price_adjustment_reason || 'Não informado'}]`
    }

    // Build SaleFormValues for processSale
    const saleFormData: SaleFormValues = {
      customer_id: appointment.customer_id || null,
      customer_name_override: !appointment.customer_id ? appointment.customer_name_snapshot : null,
      collaborator_id: appointment.professional_id,
      payment_method_id: saleData.payment_method_id,
      discount_amount: saleData.discount_amount || 0,
      notes: saleNotes,
      items: saleData.items.map((item, idx) => {
        let cost = item.unitCost || 0
        if (item.type === 'product' && item.productId) {
          const dbProd = dbProducts.find(p => p.id === item.productId)
          if (dbProd) {
            cost = dbProd.cost_price || 0
          }
        }
        return {
          id: `cmd-${idx}`,
          type: item.type,
          productId: item.productId || null,
          serviceId: item.serviceId || null,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: cost,
          discount: item.discount || 0,
        }
      }),
    }

    // ── Call the official sale engine ──
    const saleResult = await processSale(saleFormData)

    if (!saleResult.success) {
      return { success: false, error: saleResult.error || "Erro ao processar venda" }
    }

    // ── Link sale to appointment and mark completed ──
    const { error: updateErr } = await supabase
      .from('appointments')
      .update({
        status: 'completed',
        linked_sale_id: saleResult.data?.id,
        updated_by: ctx.userProfileId,
      })
      .eq('id', appointmentId)

    if (updateErr) {
      console.error("Failed to link sale to appointment:", updateErr)
    }

    // ── Subscription: consume occurrence on complete (idempotent) ──
    if (appointment.is_subscription && appointment.subscription_occurrence_id) {
      await markOccurrenceUsed(appointment.subscription_occurrence_id, appointmentId, 'completed')
    }

    // ── Log Audit for price adjustment ──
    if (isPriceAdjusted) {
      const adjustmentAmount = chargedPrice - originalPrice
      const { error: auditErr } = await supabase
        .from('audit_logs')
        .insert({
          actor_id: ctx.userProfileId,
          action: 'service_price_adjusted_on_checkout',
          entity_type: 'appointment',
          entity_id: appointmentId,
          before_data: {
            appointment_id: appointmentId,
            service_name: appointment.service_name_snapshot,
            original_price: originalPrice,
          },
          after_data: {
            charged_price: chargedPrice,
            adjustment_amount: adjustmentAmount,
            adjustment_percent: diffPercent,
            reason: saleData.service_price_adjustment_reason || '',
            adjusted_by: ctx.userProfileId,
          },
          context: {
            source: 'command_sheet',
            professional_id: appointment.professional_id,
            customer_name_snapshot: appointment.customer_name_snapshot,
          },
        })

      if (auditErr) {
        console.error("Failed to insert price adjustment audit log:", auditErr)
      }
    }

    // Standard audit log
    await logAudit({
      action: 'UPDATE',
      entity: 'appointments',
      entity_id: appointmentId,
      newData: { status: 'completed', linked_sale_id: saleResult.data?.id },
      observation: `Comanda finalizada. Venda #${saleResult.data?.id?.split('-')[0]} criada via processSale. Total: R$ ${totalFinal.toFixed(2)}`,
    })

    revalidatePath("/agendamento")
    revalidatePath("/vendas")
    revalidatePath("/caixa")
    revalidatePath("/dashboard")
    revalidatePath("/fluxo-de-caixa")

    // ── Push Notification: appointment_completed ──
    try {
      const notifData = {
        appointmentId,
        customerName: appointment.customer_name_snapshot || 'Cliente',
        serviceName: appointment.service_name_snapshot || 'Serviço',
        professionalId: appointment.professional_id,
        professionalName: appointment.professional?.name || 'Profissional',
      }

      const targets = [...(await resolveAdminTargets())]
      if (appointment.professional_id) {
        const profTarget = await resolveProfessionalTarget(appointment.professional_id)
        if (profTarget) targets.push(profTarget)
      }

      const payload = buildAppointmentCompletedPayload(notifData, 'admin')
      await dispatchNotification({
        eventType: 'appointment_completed',
        entityType: 'appointment',
        entityId: appointmentId,
        idempotencyKey: `appointment_completed:${appointmentId}`,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        targets,
        createdBy: ctx.userProfileId,
      })
    } catch {}

    return { success: true, data: { appointment: { ...appointment, status: 'completed' }, sale: saleResult.data } }
  } catch (err: any) {
    console.error("Complete Appointment Error:", err)
    return { success: false, error: err.message || "Erro ao finalizar comanda" }
  }
}

// ══════════════════════════════════════════════════════════
// BLOCKS
// ══════════════════════════════════════════════════════════

export async function createBlock(data: BlockFormValues) {
  try {
    const validated = blockSchema.parse(data)
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    if (!ctx.hasAdminAccess) {
      if (ctx.collaboratorId && validated.professional_id !== ctx.collaboratorId) {
        return { success: false, error: "Você só pode bloquear sua própria agenda." }
      }
    }

    const startAtDate = buildSaoPauloDateTime(validated.start_date, validated.start_time)
    const endAtDate = buildSaoPauloDateTime(validated.end_date, validated.end_time)
    const startAt = startAtDate.toISOString()
    const endAt = endAtDate.toISOString()

    const { data: block, error } = await supabase
      .from('appointment_blocks')
      .insert({
        professional_id: validated.professional_id,
        start_at: startAt,
        end_at: endAt,
        block_type: validated.block_type,
        reason: validated.reason,
        is_active: true,
        created_by: ctx.userProfileId,
      })
      .select()
      .single()

    if (error) throw error

    await logAudit({
      action: 'INSERT',
      entity: 'appointment_blocks',
      entity_id: block.id,
      newData: block,
      observation: `Bloqueio criado: ${validated.reason}`,
    })

    revalidatePath("/agendamento")
    return { success: true, data: block }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao criar bloqueio" }
  }
}

export async function cancelBlock(id: string) {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    const { data: oldData } = await supabase.from('appointment_blocks').select('*').eq('id', id).single()

    // Permission: professional can only cancel their own blocks
    if (!ctx.hasAdminAccess && oldData) {
      if (ctx.collaboratorId && oldData.professional_id !== ctx.collaboratorId) {
        return { success: false, error: "Você só pode cancelar seus próprios bloqueios." }
      }
    }

    const { data: updated, error } = await supabase
      .from('appointment_blocks')
      .update({
        is_active: false,
        cancelled_by: ctx.userProfileId,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    await logAudit({
      action: 'UPDATE',
      entity: 'appointment_blocks',
      entity_id: id,
      oldData,
      newData: updated,
      observation: `Bloqueio removido`,
    })

    revalidatePath("/agendamento")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao cancelar bloqueio" }
  }
}

// ══════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════

export async function saveAgendaSettings(data: AgendaSettingsFormValues) {
  try {
    const validated = agendaSettingsSchema.parse(data)
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    if (!ctx.hasAdminAccess) {
      return { success: false, error: "Apenas administradores podem alterar configurações da agenda." }
    }

    // Get existing or create
    const { data: existing } = await supabase.from('agenda_settings').select('id').limit(1).single()

    let result: any
    if (existing) {
      const { data: updated, error } = await supabase
        .from('agenda_settings')
        .update(validated)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      result = updated
    } else {
      const { data: created, error } = await supabase
        .from('agenda_settings')
        .insert(validated)
        .select()
        .single()
      if (error) throw error
      result = created
    }

    await logAudit({
      action: 'UPDATE',
      entity: 'agenda_settings',
      entity_id: result.id,
      newData: result,
      observation: `Configurações da agenda atualizadas`,
    })

    revalidatePath("/agendamento")
    return { success: true, data: result }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao salvar configurações" }
  }
}

export async function saveProfessionalHours(professionalId: string, hours: Array<{
  weekday: number; start_time: string; end_time: string; break_start_time?: string | null; break_end_time?: string | null; is_active: boolean
}>) {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    if (!ctx.hasAdminAccess) {
      return { success: false, error: "Apenas administradores podem alterar jornadas." }
    }

    // Upsert each weekday
    for (const h of hours) {
      await supabase
        .from('professional_working_hours')
        .upsert({
          professional_id: professionalId,
          weekday: h.weekday,
          start_time: h.start_time,
          end_time: h.end_time,
          break_start_time: h.break_start_time || null,
          break_end_time: h.break_end_time || null,
          is_active: h.is_active,
        }, { onConflict: 'professional_id,weekday' })
    }

    await logAudit({
      action: 'UPDATE',
      entity: 'professional_working_hours',
      entity_id: professionalId,
      newData: { professionalId, hours },
      observation: `Jornada do profissional atualizada`,
    })

    revalidatePath("/agendamento")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao salvar jornada" }
  }
}

// ══════════════════════════════════════════════════════════
// WAITLIST
// ══════════════════════════════════════════════════════════

export async function addWaitlistItem(data: WaitlistFormValues) {
  try {
    const validated = waitlistSchema.parse(data)
    const supabase = await createServerClient()

    const { data: item, error } = await supabase
      .from('appointment_waitlist')
      .insert({
        customer_id: validated.customer_id || null,
        customer_name_snapshot: validated.customer_name,
        customer_phone_snapshot: validated.customer_phone || null,
        desired_professional_id: validated.desired_professional_id || null,
        desired_service_id: validated.desired_service_id || null,
        desired_date: validated.desired_date || null,
        preferred_period: validated.preferred_period,
        notes: validated.notes || null,
        status: 'waiting',
      })
      .select()
      .single()

    if (error) throw error

    await logAudit({
      action: 'INSERT',
      entity: 'appointment_waitlist',
      entity_id: item.id,
      newData: item,
      observation: `Lista de espera: ${validated.customer_name}`,
    })

    revalidatePath("/agendamento")
    return { success: true, data: item }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao adicionar à lista de espera" }
  }
}

export async function cancelWaitlistItem(id: string) {
  try {
    const supabase = await createServerClient()

    await logAudit({
      action: 'UPDATE',
      entity: 'appointment_waitlist',
      entity_id: id,
      observation: 'Item da lista de espera cancelado',
    })

    const { error } = await supabase
      .from('appointment_waitlist')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (error) throw error

    revalidatePath("/agendamento")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao cancelar item da lista" }
  }
}

export async function updateWaitlistStatus(id: string, status: string) {
  try {
    const supabase = await createServerClient()

    const { error } = await supabase
      .from('appointment_waitlist')
      .update({ status })
      .eq('id', id)

    if (error) throw error

    await logAudit({
      action: 'UPDATE',
      entity: 'appointment_waitlist',
      entity_id: id,
      observation: `Status da lista de espera atualizado para: ${status}`,
    })

    revalidatePath("/agendamento")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao atualizar status" }
  }
}

export async function convertWaitlistToAppointment(
  waitlistId: string,
  appointmentData: AppointmentFormValues
) {
  try {
    const supabase = await createServerClient()

    // Create appointment using existing createAppointment logic
    const appointmentResult = await createAppointment(appointmentData)
    if (!appointmentResult.success) {
      return { success: false, error: appointmentResult.error }
    }

    // Mark waitlist as scheduled and link appointment
    const { error } = await supabase
      .from('appointment_waitlist')
      .update({
        status: 'scheduled',
        converted_appointment_id: appointmentResult.data?.id,
      })
      .eq('id', waitlistId)

    if (error) {
      console.error("Failed to link waitlist to appointment:", error)
    }

    await logAudit({
      action: 'UPDATE',
      entity: 'appointment_waitlist',
      entity_id: waitlistId,
      observation: `Convertido em agendamento: ${appointmentResult.data?.id}`,
    })

    revalidatePath("/agendamento")
    return { success: true, data: appointmentResult.data }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao converter item da lista" }
  }
}

// ══════════════════════════════════════════════════════════
// REOPEN APPOINTMENT (completed / no_show → scheduled)
// ══════════════════════════════════════════════════════════

export async function reopenAppointment(id: string) {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    // Only admin can reopen
    if (!ctx.hasAdminAccess) {
      return { success: false, error: "Apenas administradores podem reabrir atendimentos." }
    }

    // Fetch current appointment
    const { data: appointment, error: fetchErr } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !appointment) {
      return { success: false, error: "Agendamento não encontrado." }
    }

    // Only completed or no_show can be reopened
    if (!['completed', 'no_show'].includes(appointment.status)) {
      return { success: false, error: `Status "${appointment.status}" não permite reabertura. Apenas finalizados ou ausências podem ser reabertos.` }
    }

    // SAFETY: If completed with linked sale, check sale status before blocking
    let saleWasReversed = false
    if (appointment.status === 'completed' && appointment.linked_sale_id) {
      const { data: linkedSale } = await supabase
        .from('sales')
        .select('id, status')
        .eq('id', appointment.linked_sale_id)
        .single()

      // If sale exists and is still active/completed → block
      if (linkedSale && !['cancelled', 'refunded'].includes(linkedSale.status)) {
        return {
          success: false,
          error: "Este atendimento ainda possui venda ativa. Estorne a venda antes de reabrir.",
        }
      }
      // Sale not found or already cancelled/refunded → allow reopening
      saleWasReversed = true
    }

    // Perform the reopen
    const { data: updated, error: updateErr } = await supabase
      .from('appointments')
      .update({
        status: 'scheduled',
        updated_by: ctx.userProfileId,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) throw updateErr

    await logAudit({
      action: 'reopen_appointment',
      entity: 'appointments',
      entity_id: id,
      oldData: appointment,
      newData: updated,
      observation: `Atendimento reaberto: ${appointment.status} → scheduled. ${saleWasReversed ? 'Venda vinculada estornada/cancelada detectada. Reabertura permitida.' : appointment.status === 'no_show' ? 'Ausência revertida.' : 'Sem venda vinculada.'}`,
      context: {
        origem: 'agenda_interna',
        financeiro_estornado_detectado: saleWasReversed,
        venda_bloqueante_detectada: false,
        status_anterior: appointment.status,
        linked_sale_id: appointment.linked_sale_id || null,
      },
    })

    revalidatePath("/agendamento")
    return { success: true, data: updated }
  } catch (err: any) {
    console.error("Reopen Appointment Error:", err)
    return { success: false, error: err.message || "Erro ao reabrir atendimento" }
  }
}

// ══════════════════════════════════════════════════════════
// RECURRING APPOINTMENTS
// ══════════════════════════════════════════════════════════

export async function createRecurringAppointments(
  baseData: AppointmentFormValues,
  recurrence: {
    type: 'weekly' | 'biweekly' | 'monthly'
    count: number // max 12
  }
) {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    if (!ctx.hasAdminAccess) {
      if (ctx.collaboratorId && baseData.professional_id !== ctx.collaboratorId) {
        return { success: false, error: "Você só pode criar agendamentos recorrentes para sua própria agenda." }
      }
    }

    const maxCount = Math.min(recurrence.count, 12)
    const groupId = crypto.randomUUID()
    const created: string[] = []
    const conflicts: string[] = []
    const errors: string[] = []

    // Calculate interval in days
    const intervalDays = recurrence.type === 'weekly' ? 7 : recurrence.type === 'biweekly' ? 14 : 0
    const isMonthly = recurrence.type === 'monthly'

    for (let i = 0; i < maxCount; i++) {
      // Calculate target date
      const baseDate = new Date(`${baseData.start_date}T12:00:00`)
      let targetDate: Date

      if (isMonthly) {
        targetDate = new Date(baseDate)
        targetDate.setMonth(targetDate.getMonth() + i)
      } else {
        targetDate = new Date(baseDate)
        targetDate.setDate(targetDate.getDate() + (intervalDays * i))
      }

      const dateStr = targetDate.toISOString().split('T')[0]

      // Build start/end times for validation
      const startAtDate = buildSaoPauloDateTime(dateStr, baseData.start_time)
      const startAt = startAtDate.toISOString()
      const duration = baseData.duration_minutes || 30
      const endAtDate = addMinutes(startAtDate, duration)
      const endAt = endAtDate.toISOString()

      // Check working hours for target weekday
      const weekday = targetDate.getDay()
      const { data: workingHours } = await supabase
        .from('professional_working_hours')
        .select('*')
        .eq('professional_id', baseData.professional_id)
        .eq('weekday', weekday)
        .eq('is_active', true)
        .single()

      if (!workingHours) {
        conflicts.push(`${dateStr} — profissional não trabalha neste dia`)
        continue
      }

      // Check if time is within working hours
      const timeMinutes = parseInt(baseData.start_time.split(':')[0]) * 60 + parseInt(baseData.start_time.split(':')[1])
      const whStart = parseInt(workingHours.start_time.split(':')[0]) * 60 + parseInt(workingHours.start_time.split(':')[1])
      const whEnd = parseInt(workingHours.end_time.split(':')[0]) * 60 + parseInt(workingHours.end_time.split(':')[1])

      if (timeMinutes < whStart || timeMinutes >= whEnd) {
        conflicts.push(`${dateStr} — fora da jornada do profissional`)
        continue
      }

      // Check break
      if (workingHours.break_start_time && workingHours.break_end_time) {
        const bsMin = parseInt(workingHours.break_start_time.split(':')[0]) * 60 + parseInt(workingHours.break_start_time.split(':')[1])
        const beMin = parseInt(workingHours.break_end_time.split(':')[0]) * 60 + parseInt(workingHours.break_end_time.split(':')[1])
        if (timeMinutes >= bsMin && timeMinutes < beMin) {
          conflicts.push(`${dateStr} — horário no intervalo de pausa`)
          continue
        }
      }

      // Check conflicts
      const { data: existingConflicts } = await supabase
        .from('appointments')
        .select('id')
        .eq('professional_id', baseData.professional_id)
        .not('status', 'in', '("cancelled","no_show")')
        .lt('start_at', endAt)
        .gt('end_at', startAt)

      if (existingConflicts && existingConflicts.length > 0) {
        const { data: settings } = await supabase.from('agenda_settings').select('allow_overbooking').limit(1).single()
        if (!settings?.allow_overbooking) {
          conflicts.push(`${dateStr} — conflito com agendamento existente`)
          continue
        }
      }

      // Check blocks
      const { data: blocks } = await supabase
        .from('appointment_blocks')
        .select('id')
        .eq('professional_id', baseData.professional_id)
        .eq('is_active', true)
        .lt('start_at', endAt)
        .gt('end_at', startAt)

      if (blocks && blocks.length > 0) {
        conflicts.push(`${dateStr} — horário bloqueado`)
        continue
      }

      // Resolve service snapshot
      let serviceSnapshot: any = {}
      if (baseData.service_id) {
        const { data: svc } = await supabase.from('services').select('id, name, price, duration_minutes').eq('id', baseData.service_id).single()
        if (svc) {
          serviceSnapshot = {
            service_name_snapshot: svc.name,
            service_price_snapshot: svc.price,
            service_duration_minutes_snapshot: svc.duration_minutes,
          }
        }
      }

      // Resolve customer snapshot
      let customerSnapshot: any = { customer_name_snapshot: baseData.customer_name }
      if (baseData.customer_id) {
        const { data: cust } = await supabase.from('customers').select('full_name, phone, mobile_phone').eq('id', baseData.customer_id).single()
        if (cust) {
          customerSnapshot = {
            customer_name_snapshot: cust.full_name,
            customer_phone_snapshot: cust.phone || cust.mobile_phone,
          }
        }
      } else if (baseData.customer_phone) {
        customerSnapshot.customer_phone_snapshot = baseData.customer_phone
      }

      // Create appointment
      const { data: appointment, error } = await supabase
        .from('appointments')
        .insert({
          customer_id: baseData.customer_id || null,
          ...customerSnapshot,
          professional_id: baseData.professional_id,
          service_id: baseData.service_id || null,
          ...serviceSnapshot,
          start_at: startAt,
          end_at: endAt,
          status: 'scheduled',
          source: ctx.hasAdminAccess ? 'admin' : 'professional',
          notes: baseData.notes || null,
          recurrence_rule: { group_id: groupId, type: recurrence.type, index: i, total: maxCount },
          created_by: ctx.userProfileId,
        })
        .select()
        .single()

      if (error) {
        errors.push(`${dateStr} — ${error.message}`)
        continue
      }

      // Add service as command item if applicable
      if (baseData.service_id && serviceSnapshot.service_name_snapshot) {
        await supabase.from('appointment_command_items').insert({
          appointment_id: appointment.id,
          item_type: 'service',
          service_id: baseData.service_id,
          description_snapshot: serviceSnapshot.service_name_snapshot,
          quantity: 1,
          unit_price_snapshot: serviceSnapshot.service_price_snapshot || 0,
          professional_id: baseData.professional_id,
        })
      }

      created.push(dateStr)
    }

    await logAudit({
      action: 'INSERT',
      entity: 'appointments',
      entity_id: groupId,
      newData: { recurrence, created: created.length, conflicts: conflicts.length },
      observation: `Recorrência criada: ${created.length} de ${maxCount} agendamentos. Tipo: ${recurrence.type}. Conflitos: ${conflicts.length}`,
    })

    revalidatePath("/agendamento")
    return {
      success: true,
      data: {
        groupId,
        created,
        conflicts,
        errors,
        total: maxCount,
      },
    }
  } catch (err: any) {
    console.error("Create Recurring Error:", err)
    return { success: false, error: err.message || "Erro ao criar agendamentos recorrentes" }
  }
}

// ══════════════════════════════════════════════════════════
// COMMAND ITEMS (pré-comanda)
// ══════════════════════════════════════════════════════════

export async function addCommandItem(appointmentId: string, item: {
  item_type: 'service' | 'product' | 'manual'
  service_id?: string | null
  product_id?: string | null
  description: string
  quantity: number
  unit_price: number
  professional_id?: string | null
}) {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    // Permission: professional can only add to their own appointments
    if (!ctx.hasAdminAccess) {
      const { data: appt } = await supabase.from('appointments').select('professional_id').eq('id', appointmentId).single()
      if (appt && ctx.collaboratorId && appt.professional_id !== ctx.collaboratorId) {
        return { success: false, error: "Você só pode adicionar itens na comanda dos seus próprios agendamentos." }
      }
    }

    // Consolidate quantity if product already exists in comanda
    if (item.item_type === 'product' && item.product_id) {
      // First check if the product is active/deleted/perfume
      const { data: dbProd } = await supabase
        .from('inventory_products')
        .select(`
          id, name, external_code, is_active, deleted_at, is_deleted,
          category:category_id (id, name, slug)
        `)
        .eq('id', item.product_id)
        .single()

      if (!dbProd) {
        return { success: false, error: "Produto não encontrado." }
      }
      if (!dbProd.is_active) {
        return { success: false, error: "Este produto está inativo." }
      }
      if (dbProd.deleted_at || dbProd.is_deleted) {
        return { success: false, error: "Este produto foi excluído." }
      }
      if (isPerfumeProduct(dbProd)) {
        return { success: false, error: "Perfumes possuem fluxo próprio de venda e não podem ser adicionados por esta comanda." }
      }

      const { data: existing } = await supabase
        .from('appointment_command_items')
        .select('id, quantity')
        .eq('appointment_id', appointmentId)
        .eq('product_id', item.product_id)
        .maybeSingle()

      if (existing) {
        const { data: updated, error } = await supabase
          .from('appointment_command_items')
          .update({ quantity: existing.quantity + item.quantity })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw error
        revalidatePath("/agendamento")
        return { success: true, data: updated }
      }
    }

    const { data: cmdItem, error } = await supabase
      .from('appointment_command_items')
      .insert({
        appointment_id: appointmentId,
        item_type: item.item_type,
        service_id: item.service_id || null,
        product_id: item.product_id || null,
        description_snapshot: item.description,
        quantity: item.quantity,
        unit_price_snapshot: item.unit_price,
        professional_id: item.professional_id || null,
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath("/agendamento")
    return { success: true, data: cmdItem }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao adicionar item na comanda" }
  }
}

export async function removeCommandItem(id: string) {
  try {
    const supabase = await createServerClient()
    const { error } = await supabase.from('appointment_command_items').delete().eq('id', id)
    if (error) throw error
    revalidatePath("/agendamento")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao remover item da comanda" }
  }
}

export async function updateCommandItemQuantity(id: string, quantity: number) {
  try {
    const supabase = await createServerClient()
    if (quantity <= 0) {
      const { error } = await supabase.from('appointment_command_items').delete().eq('id', id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('appointment_command_items')
        .update({ quantity })
        .eq('id', id)
      if (error) throw error
    }
    revalidatePath("/agendamento")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || "Erro ao atualizar quantidade" }
  }
}

// ══════════════════════════════════════════════════════════
// CREATE CUSTOMER APPOINTMENT (ÁREA DO CLIENTE)
// ══════════════════════════════════════════════════════════

interface CustomerAppointmentInput {
  serviceId: string
  professionalId: string
  date: string
  startTime: string
  notes?: string
  /** Optional addon service IDs for composed booking */
  addonServiceIds?: string[]
}

export async function createCustomerAppointment(data: CustomerAppointmentInput) {
  try {
    const supabase = await createServerClient()
    
    // 1. Verify Authentication (via session cookies)
    const { data: authData } = await supabase.auth.getUser()
    const authUser = authData.user
    if (!authUser?.id) {
      return { success: false, error: "Usuário não autenticado." }
    }

    // Use service-role client for all DB operations (bypass RLS)
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const adminDb = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 2. ENSURE customer record exists (idempotent sync)
    const { ensureCustomerForAuthUser } = await import('@/features/customers/services/customer-auth-sync.service')
    const ensureResult = await ensureCustomerForAuthUser(authUser.id, {
      email: authUser.email,
      fullName: authUser.user_metadata?.full_name,
      phone: authUser.user_metadata?.phone,
    })

    if (!ensureResult.success || !ensureResult.customerId) {
      // Specific error messages based on failure code
      if (ensureResult.code === 'CONFLICT_EMAIL') {
        return { success: false, error: "Este e-mail já está vinculado a outra conta. Entre com a conta correta ou fale com a barbearia." }
      }
      if (ensureResult.code === 'CONFLICT_PHONE') {
        return { success: false, error: "Este telefone já está vinculado a outra conta. Entre com a conta correta ou fale com a barbearia." }
      }
      if (ensureResult.code === 'AUTH_USER_NOT_FOUND') {
        return { success: false, error: "Sessão inválida. Faça logout e login novamente." }
      }
      return { success: false, error: ensureResult.error || "Não foi possível vincular seu registro de cliente. Tente fazer logout e login novamente." }
    }

    // 3. Fetch full Customer Record (now guaranteed to exist)
    const { data: customer, error: custErr } = await adminDb
      .from('customers')
      .select('id, full_name, phone, mobile_phone, is_active')
      .eq('id', ensureResult.customerId)
      .single() as { data: any, error: any }

    if (custErr || !customer) {
      return { success: false, error: "Registro de cliente não encontrado." }
    }
    if (!customer.is_active) {
      return { success: false, error: "Sua conta está inativa. Entre em contato com a barbearia." }
    }

    // 3. Fetch Service
    const { data: service, error: svcErr } = await adminDb
      .from('services')
      .select('id, name, price, duration_minutes, is_active, is_bookable')
      .eq('id', data.serviceId)
      .single()

    if (svcErr || !service) {
      return { success: false, error: "Serviço não encontrado." }
    }
    if (!service.is_active || !service.is_bookable) {
      return { success: false, error: "Este serviço não está disponível para agendamento online." }
    }
    if (!service.duration_minutes) {
      return { success: false, error: "Serviço sem duração configurada." }
    }

    // 4. Fetch Professional
    const { data: professional, error: profErr } = await adminDb
      .from('collaborators')
      .select('id, name, is_active')
      .eq('id', data.professionalId)
      .single()

    if (profErr || !professional) {
      return { success: false, error: "Profissional não encontrado." }
    }
    if (!professional.is_active) {
      return { success: false, error: "Profissional não está ativo no momento." }
    }

    // ── Addon Validation (if provided) ──
    let addonServices: CompositionServiceInput[] = []
    if (data.addonServiceIds && data.addonServiceIds.length > 0) {
      const { data: addons, error: addonsErr } = await adminDb
        .from('services')
        .select('id, name, price, duration_minutes, is_active, is_bookable, description, category_id')
        .in('id', data.addonServiceIds)

      if (addonsErr || !addons || addons.length !== data.addonServiceIds.length) {
        return { success: false, error: "Um ou mais adicionais não foram encontrados." }
      }

      // Validate each addon is active and bookable
      for (const addon of addons) {
        if (!addon.is_active || !addon.is_bookable) {
          return { success: false, error: `Adicional "${addon.name}" não está disponível para agendamento.` }
        }
        if (!addon.duration_minutes) {
          return { success: false, error: `Adicional "${addon.name}" não tem duração configurada.` }
        }
      }

      addonServices = addons as CompositionServiceInput[]

      // Validate compatibility
      const compat = validateCompositionCompatibility(service as CompositionServiceInput, addonServices)
      if (!compat.valid) {
        return { success: false, error: compat.errors[0] }
      }
    }

    // ── Calculate Composition (backend is source of truth) ──
    const composition = calculateServiceComposition({
      mainService: service as CompositionServiceInput,
      addons: addonServices,
    })

    // 5. Calculate Times (using composed duration)
    const startAtDate = buildSaoPauloDateTime(data.date, data.startTime)
    const endAtDate = addMinutes(startAtDate, composition.totalDurationMinutes)
    const startAt = startAtDate.toISOString()
    const endAt = endAtDate.toISOString()

    // Prevent past dates
    if (new Date(startAt) < new Date()) {
      return { success: false, error: "Não é possível agendar em um horário que já passou." }
    }

    // 6. Conflict Check (Appointments)
    const { data: conflicts } = await adminDb
      .from('appointments')
      .select('id')
      .eq('professional_id', data.professionalId)
      .not('status', 'in', '("cancelled","no_show")')
      .lt('start_at', endAt)
      .gt('end_at', startAt)

    if (conflicts && conflicts.length > 0) {
      // For customer app, NEVER allow overbooking, regardless of settings.
      return { success: false, error: "Este horário acabou de ser ocupado. Escolha outro horário." }
    }

    // 7. Block Check
    const { data: blocks } = await adminDb
      .from('appointment_blocks')
      .select('id')
      .eq('professional_id', data.professionalId)
      .eq('is_active', true)
      .lt('start_at', endAt)
      .gt('end_at', startAt)

    if (blocks && blocks.length > 0) {
      return { success: false, error: "Horário indisponível (bloqueado)." }
    }

    // 8. Snapshots
    const customerPhone = customer.mobile_phone || customer.phone || null

    // 9. Insert Appointment (with composed snapshots)
    const { data: appointment, error: insertError } = await adminDb
      .from('appointments')
      .insert({
        customer_id: customer.id,
        customer_name_snapshot: customer.full_name,
        customer_phone_snapshot: customerPhone,
        professional_id: data.professionalId,
        service_id: service.id,
        service_name_snapshot: composition.displayName,
        service_price_snapshot: composition.totalPrice,
        service_duration_minutes_snapshot: composition.totalDurationMinutes,
        start_at: startAt,
        end_at: endAt,
        status: 'scheduled',
        source: 'customer',
        notes: data.notes || null,
      } as any)
      .select()
      .single() as { data: any, error: any }

    if (insertError) throw insertError

    // 10. Add main service as command item
    await adminDb.from('appointment_command_items').insert({
      appointment_id: appointment.id,
      item_type: 'service',
      service_id: service.id,
      description_snapshot: service.name,
      quantity: 1,
      unit_price_snapshot: service.price || 0,
      professional_id: data.professionalId,
    })

    // 11. Add addon services as command items (if any)
    if (addonServices.length > 0) {
      const addonItems = addonServices.map(addon => ({
        appointment_id: appointment.id,
        item_type: 'service' as const,
        service_id: addon.id,
        description_snapshot: addon.name,
        quantity: 1,
        unit_price_snapshot: addon.price || 0,
        professional_id: data.professionalId,
      }))
      await adminDb.from('appointment_command_items').insert(addonItems)
    }

    await logAudit({
      action: 'INSERT',
      entity: 'appointments',
      entity_id: appointment.id,
      newData: appointment,
      observation: `Agendamento criado pelo APP CLIENTE: ${customer.full_name} — ${composition.displayName} às ${data.startTime}${addonServices.length > 0 ? ` (${addonServices.length} adicional/ais)` : ''}`,
    })

    revalidatePath("/agendamento")
    revalidatePath("/cliente/meus-agendamentos")

    // ── Push Notification: appointment_created (by customer) ──
    try {
      let professionalName = 'Profissional'
      const { data: profData } = await adminDb.from('collaborators').select('name, display_name').eq('id', data.professionalId).single()
      if (profData) professionalName = profData.display_name || profData.name

      const notifData = {
        appointmentId: appointment.id,
        customerName: customer.full_name || 'Cliente',
        serviceName: composition.displayName || 'Serviço',
        professionalName,
        professionalId: data.professionalId,
        startTime: data.startTime,
        startDate: data.startDate,
      }

      const targets = [...(await resolveAdminTargets())]
      const profTarget = await resolveProfessionalTarget(data.professionalId)
      if (profTarget) targets.push(profTarget)

      const payload = buildAppointmentCreatedPayload(notifData, 'admin')
      await dispatchNotification({
        eventType: 'appointment_created',
        entityType: 'appointment',
        entityId: appointment.id,
        idempotencyKey: `appointment_created:${appointment.id}`,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        targets,
      })
    } catch {}

    return { success: true, data: appointment }

  } catch (err: any) {
    console.error("createCustomerAppointment Error:", err)
    return { success: false, error: err.message || "Erro interno ao criar agendamento." }
  }
}

// ══════════════════════════════════════════════════════════
// CANCEL CUSTOMER APPOINTMENT (ÁREA DO CLIENTE)
// ══════════════════════════════════════════════════════════

const CANCELLABLE_STATUSES = ['scheduled', 'confirmed'] as const

interface CancelCustomerAppointmentInput {
  appointmentId: string
  reason?: string
}

export async function cancelCustomerAppointment(data: CancelCustomerAppointmentInput) {
  try {
    const supabase = await createServerClient()

    // 1. Verify Authentication
    const { data: authData } = await supabase.auth.getUser()
    const authUser = authData.user
    if (!authUser?.id) {
      return { success: false, error: "Usuário não autenticado." }
    }

    // 2. Resolve customer identity
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const adminDb = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { ensureCustomerForAuthUser } = await import('@/features/customers/services/customer-auth-sync.service')
    const ensureResult = await ensureCustomerForAuthUser(authUser.id, {
      email: authUser.email,
      fullName: authUser.user_metadata?.full_name,
      phone: authUser.user_metadata?.phone,
    })

    if (!ensureResult.success || !ensureResult.customerId) {
      return { success: false, error: "Não foi possível verificar sua identidade de cliente." }
    }

    const customerId = ensureResult.customerId

    // 3. Fetch appointment with full context
    const { data: appointment, error: fetchErr } = await adminDb
      .from('appointments')
      .select(`
        id, customer_id, professional_id, status,
        start_at, end_at,
        service_name_snapshot, service_price_snapshot,
        customer_name_snapshot,
        collaborators (name)
      `)
      .eq('id', data.appointmentId)
      .single() as { data: any, error: any }

    if (fetchErr || !appointment) {
      return { success: false, error: "Agendamento não encontrado." }
    }

    // 4. Ownership check
    if (appointment.customer_id !== customerId) {
      return { success: false, error: "Este agendamento não pertence à sua conta." }
    }

    // 5. Status check — only scheduled/confirmed can be cancelled
    if (!CANCELLABLE_STATUSES.includes(appointment.status)) {
      if (appointment.status === 'cancelled') {
        return { success: false, error: "Este agendamento já foi cancelado." }
      }
      return { success: false, error: "Este agendamento não pode mais ser cancelado pelo app." }
    }

    // 6. Future check — appointment must be in the future
    const appointmentStart = new Date(appointment.start_at)
    if (appointmentStart <= new Date()) {
      return { success: false, error: "Não é possível cancelar um agendamento que já passou." }
    }

    // 7. Update status to cancelled + fill cancellation fields
    const now = new Date().toISOString()
    const reasonText = data.reason?.trim() || null

    const { error: updateErr } = await adminDb
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        // cancelled_by references user_profiles(id) — customers don't have user_profile
        // so we leave it null and record customer context in cancellation_reason
        cancelled_by: null,
        cancellation_reason: reasonText
          ? `[CLIENTE] ${reasonText}`
          : '[CLIENTE] Cancelado pelo cliente via app',
      } as any)
      .eq('id', appointment.id)

    if (updateErr) {
      console.error("cancelCustomerAppointment update error:", updateErr)
      return { success: false, error: "Erro ao cancelar agendamento. Tente novamente." }
    }

    // 8. Format date for audit message
    const startDate = new Date(appointment.start_at)
    const formattedDate = startDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
    const formattedTime = startDate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
    const professionalName = appointment.collaborators?.name || 'Profissional'
    const customerName = appointment.customer_name_snapshot || ensureResult.fullName || 'Cliente'
    const serviceName = appointment.service_name_snapshot || 'Serviço'
    const reasonMsg = reasonText || 'não informado'

    // 9. Audit log with full context
    await logAudit({
      action: 'UPDATE',
      entity: 'appointments',
      entity_id: appointment.id,
      oldData: { status: appointment.status },
      newData: { status: 'cancelled', cancelled_at: now, cancellation_reason: reasonText },
      source: 'web',
      observation: `CANCELAMENTO PELO CLIENTE: ${customerName} cancelou ${serviceName} com ${professionalName} em ${formattedDate} às ${formattedTime}. Motivo: ${reasonMsg}.`,
    })

    // 10. Revalidate all affected paths
    revalidatePath("/agendamento")
    revalidatePath("/cliente/meus-agendamentos")
    revalidatePath("/cliente/agendar")
    revalidatePath("/cliente/agendar/data-hora")
    revalidatePath("/profissional/agenda")

    // ── Push Notification: appointment_cancelled (by customer) ──
    try {
      const notifData = {
        appointmentId: appointment.id,
        customerName: customerName,
        serviceName: serviceName,
        professionalId: appointment.professional_id,
        startTime: formattedTime,
      }

      const targets = [...(await resolveAdminTargets())]
      if (appointment.professional_id) {
        const profTarget = await resolveProfessionalTarget(appointment.professional_id)
        if (profTarget) targets.push(profTarget)
      }

      const payload = buildAppointmentCancelledPayload(notifData, 'admin')
      await dispatchNotification({
        eventType: 'appointment_cancelled',
        entityType: 'appointment',
        entityId: appointment.id,
        idempotencyKey: `appointment_cancelled:${appointment.id}:${now}`,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        targets,
      })
    } catch {}

    return { success: true }

  } catch (err: any) {
    console.error("cancelCustomerAppointment Error:", err)
    return { success: false, error: err.message || "Erro interno ao cancelar agendamento." }
  }
}

