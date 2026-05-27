/**
 * Barber Zac ERP — WhatsApp Agent Access Service (Server-Only)
 *
 * Controlled, read-only access layer for the WhatsApp agent
 * to safely query agenda, customers, and availability.
 *
 * Rules:
 * - Agent NEVER creates real appointments in this phase
 * - Agent NEVER modifies agenda directly
 * - Agent CAN read availability and customer data
 * - All queries use service role (admin) with explicit scoping
 */

import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Get agenda summary for a specific date.
 * Returns appointments count, list of scheduled appointments (no sensitive data).
 */
export async function getAgendaSummaryForAgent(date: string): Promise<{
  success: boolean
  data?: {
    date: string
    totalAppointments: number
    appointments: Array<{
      id: string
      customerName: string
      professionalName: string
      serviceName: string
      startTime: string
      durationMinutes: number
      status: string
    }>
  }
  error?: string
}> {
  try {
    const supabase = getAdminClient()

    const startOfDay = `${date}T00:00:00`
    const endOfDay = `${date}T23:59:59`

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        customer_name_snapshot,
        start_time,
        duration_minutes,
        status,
        services(name),
        professionals(display_name)
      `)
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay)
      .in('status', ['confirmed', 'pending', 'in_progress'])
      .order('start_time')

    if (error) {
      console.error('[AgentAccess] getAgendaSummary error:', error)
      return { success: false, error: 'Erro ao consultar agenda.' }
    }

    const appointments = (data || []).map((a: any) => ({
      id: a.id,
      customerName: a.customer_name_snapshot || 'Cliente',
      professionalName: a.professionals?.display_name || 'Profissional',
      serviceName: a.services?.name || 'Serviço',
      startTime: a.start_time,
      durationMinutes: a.duration_minutes,
      status: a.status,
    }))

    return {
      success: true,
      data: {
        date,
        totalAppointments: appointments.length,
        appointments,
      },
    }
  } catch (err) {
    console.error('[AgentAccess] getAgendaSummary exception:', err)
    return { success: false, error: 'Erro interno ao consultar agenda.' }
  }
}

/**
 * Find customer by phone number (normalized digits only).
 */
export async function findCustomerByPhone(phone: string): Promise<{
  success: boolean
  data?: {
    id: string
    fullName: string
    email: string | null
    phone: string | null
  } | null
  error?: string
}> {
  try {
    const normalized = phone.replace(/\D/g, '')
    if (normalized.length < 10) {
      return { success: false, error: 'Telefone deve ter pelo menos 10 dígitos.' }
    }

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('customers')
      .select('id, full_name, email, mobile_phone, phone')
      .eq('mobile_phone', normalized)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[AgentAccess] findCustomerByPhone error:', error)
      return { success: false, error: 'Erro ao buscar cliente.' }
    }

    if (!data) {
      return { success: true, data: null }
    }

    return {
      success: true,
      data: {
        id: data.id,
        fullName: data.full_name,
        email: data.email,
        phone: data.mobile_phone || data.phone,
      },
    }
  } catch (err) {
    console.error('[AgentAccess] findCustomerByPhone exception:', err)
    return { success: false, error: 'Erro interno ao buscar cliente.' }
  }
}

/**
 * Get upcoming appointments for a customer.
 */
export async function getCustomerAppointments(customerId: string): Promise<{
  success: boolean
  data?: Array<{
    id: string
    serviceName: string
    professionalName: string
    startTime: string
    status: string
  }>
  error?: string
}> {
  try {
    const supabase = getAdminClient()
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        start_time,
        status,
        services(name),
        professionals(display_name)
      `)
      .eq('customer_id', customerId)
      .gte('start_time', now)
      .in('status', ['confirmed', 'pending'])
      .order('start_time')
      .limit(10)

    if (error) {
      console.error('[AgentAccess] getCustomerAppointments error:', error)
      return { success: false, error: 'Erro ao buscar agendamentos.' }
    }

    return {
      success: true,
      data: (data || []).map((a: any) => ({
        id: a.id,
        serviceName: a.services?.name || 'Serviço',
        professionalName: a.professionals?.display_name || 'Profissional',
        startTime: a.start_time,
        status: a.status,
      })),
    }
  } catch (err) {
    console.error('[AgentAccess] getCustomerAppointments exception:', err)
    return { success: false, error: 'Erro interno.' }
  }
}

/**
 * Get available time slots for a service + professional on a date.
 * Uses the same availability logic as the public booking system.
 *
 * NOTE: This is a read-only query. The agent cannot book directly.
 */
export async function getAvailableSlotsForAgent(
  serviceId: string,
  professionalId: string,
  date: string
): Promise<{
  success: boolean
  data?: string[]
  error?: string
}> {
  try {
    const supabase = getAdminClient()

    // Get professional working hours
    const { data: prof } = await supabase
      .from('professionals')
      .select('id, display_name, working_hours')
      .eq('id', professionalId)
      .single()

    if (!prof) {
      return { success: false, error: 'Profissional não encontrado.' }
    }

    // Get service duration
    const { data: service } = await supabase
      .from('services')
      .select('id, name, duration_minutes')
      .eq('id', serviceId)
      .single()

    if (!service) {
      return { success: false, error: 'Serviço não encontrado.' }
    }

    // Get existing appointments for the date
    const startOfDay = `${date}T00:00:00`
    const endOfDay = `${date}T23:59:59`

    const { data: appointments } = await supabase
      .from('appointments')
      .select('start_time, duration_minutes')
      .eq('professional_id', professionalId)
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay)
      .in('status', ['confirmed', 'pending', 'in_progress'])

    // Simple slot calculation (30-min intervals)
    // Full logic lives in public-booking.actions.ts — this is a lightweight version
    const dayOfWeek = new Date(date).getDay()
    const workingHours = (prof.working_hours as any)?.[dayOfWeek]

    if (!workingHours || !workingHours.start || !workingHours.end) {
      return { success: true, data: [] } // Professional doesn't work this day
    }

    const [startH, startM] = workingHours.start.split(':').map(Number)
    const [endH, endM] = workingHours.end.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    const duration = service.duration_minutes || 30

    const bookedSlots = (appointments || []).map((a: any) => {
      const t = new Date(a.start_time)
      const mins = t.getHours() * 60 + t.getMinutes()
      return { start: mins, end: mins + (a.duration_minutes || 30) }
    })

    const available: string[] = []
    for (let m = startMinutes; m + duration <= endMinutes; m += 30) {
      const overlaps = bookedSlots.some(
        (b: { start: number; end: number }) => m < b.end && m + duration > b.start
      )
      if (!overlaps) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0')
        const mm = String(m % 60).padStart(2, '0')
        available.push(`${hh}:${mm}`)
      }
    }

    return { success: true, data: available }
  } catch (err) {
    console.error('[AgentAccess] getAvailableSlots exception:', err)
    return { success: false, error: 'Erro interno ao consultar disponibilidade.' }
  }
}
