// @ts-nocheck
"use server"

import { createServerClient } from "@/lib/supabase/server"
import { appointmentSchema, blockSchema, agendaSettingsSchema, waitlistSchema, type AppointmentFormValues, type BlockFormValues, type AgendaSettingsFormValues, type WaitlistFormValues } from "../validators"
import { logAudit } from "@/features/audit/actions/audit.actions"
import { resolveUserProfileId } from "@/lib/supabase/resolve-user"
import { processSale } from "@/features/sales/actions/sales.actions"
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
    systemRole: profile?.system_role || 'professional',
    collaboratorId: profile?.collaborator_id || null,
    hasAdminAccess: ['admin_total', 'owner_admin_professional'].includes(profile?.system_role || ''),
  }
}

function combineDatetime(date: string, time: string): string {
  return new Date(`${date}T${time}:00-03:00`).toISOString()
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
    const startAt = combineDatetime(validated.start_date, validated.start_time)
    const endDate = new Date(startAt)
    endDate.setMinutes(endDate.getMinutes() + validated.duration_minutes)
    const endAt = endDate.toISOString()

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

    const startAt = combineDatetime(validated.start_date, validated.start_time)
    const endDate = new Date(startAt)
    endDate.setMinutes(endDate.getMinutes() + validated.duration_minutes)
    const endAt = endDate.toISOString()

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

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'checked_in', updated_by: ctx.userProfileId })
      .eq('id', id)

    if (error) throw error

    await logAudit({
      action: 'UPDATE',
      entity: 'appointments',
      entity_id: id,
      observation: 'Check-in realizado',
    })

    revalidatePath("/agendamento")
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
  }
) {
  try {
    const supabase = await createServerClient()
    const ctx = await getUserContext(supabase)

    // Fetch appointment
    const { data: appointment, error: fetchErr } = await supabase
      .from('appointments')
      .select('*, professional:collaborators(id, name)')
      .eq('id', appointmentId)
      .single()

    if (fetchErr || !appointment) throw new Error("Agendamento não encontrado")
    if (appointment.status === 'completed') throw new Error("Agendamento já finalizado")
    if (appointment.status === 'cancelled') throw new Error("Agendamento cancelado")

    // Build SaleFormValues for processSale
    const saleFormData: SaleFormValues = {
      customer_id: appointment.customer_id || null,
      customer_name_override: !appointment.customer_id ? appointment.customer_name_snapshot : null,
      collaborator_id: appointment.professional_id,
      payment_method_id: saleData.payment_method_id,
      discount_amount: saleData.discount_amount || 0,
      notes: saleData.notes || `Comanda do agendamento ${appointmentId.split('-')[0]}`,
      items: saleData.items.map((item, idx) => ({
        id: `cmd-${idx}`,
        type: item.type,
        productId: item.productId || null,
        serviceId: item.serviceId || null,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        discount: item.discount || 0,
      })),
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
      // Sale was created but link failed — not a fatal error
    }

    await logAudit({
      action: 'UPDATE',
      entity: 'appointments',
      entity_id: appointmentId,
      newData: { status: 'completed', linked_sale_id: saleResult.data?.id },
      observation: `Comanda finalizada. Venda #${saleResult.data?.id?.split('-')[0]} criada via processSale. Total: R$ ${saleFormData.items.reduce((a, i) => a + i.quantity * i.unitPrice - (i.discount || 0), 0).toFixed(2)}`,
    })

    revalidatePath("/agendamento")
    revalidatePath("/vendas")
    revalidatePath("/caixa")
    revalidatePath("/dashboard")
    revalidatePath("/fluxo-de-caixa")
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

    const startAt = combineDatetime(validated.start_date, validated.start_time)
    const endAt = combineDatetime(validated.end_date, validated.end_time)

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
      const startAt = combineDatetime(dateStr, baseData.start_time)
      const duration = baseData.duration_minutes || 30
      const endDate = new Date(startAt)
      endDate.setMinutes(endDate.getMinutes() + duration)
      const endAt = endDate.toISOString()

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
