"use server"

import { createClient } from '@supabase/supabase-js'

export interface Slot {
  time: string // HH:mm
  available: boolean
}

interface GetAvailableSlotsParams {
  serviceId: string
  professionalId: string
  date: string // YYYY-MM-DD
}

export async function getCustomerAvailableSlots({
  serviceId,
  professionalId,
  date,
}: GetAvailableSlotsParams): Promise<{ success: boolean; data?: Slot[]; error?: string }> {
  try {
    // Use service role to bypass RLS — this is called from public customer routes
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Fetch Service Duration
    const { data: service, error: svcErr } = await (supabase
      .from("services") as any)
      .select("duration_minutes, is_active, is_bookable")
      .eq("id", serviceId)
      .single() as { data: any, error: any }

    if (svcErr || !service) {
      return { success: false, error: "Serviço não encontrado." }
    }
    if (!service.is_active || !service.is_bookable) {
      return { success: false, error: "Serviço indisponível para agendamento." }
    }
    if (!service.duration_minutes) {
      return { success: false, error: "Serviço sem duração configurada." }
    }

    const duration = service.duration_minutes

    // 2. Fetch Professional Working Hours for this weekday
    // Ensure the date is not in the past
    const currentDate = new Date()
    const todayStr = currentDate.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) // yyyy-mm-dd
    if (date < todayStr) {
      return { success: true, data: [] }
    }

    const targetDate = new Date(`${date}T00:00:00-03:00`)
    const weekday = targetDate.getDay() // 0 = Sunday, 1 = Monday, etc.

    const { data: workingHour } = await (supabase
      .from("professional_working_hours") as any)
      .select("*")
      .eq("professional_id", professionalId)
      .eq("weekday", weekday)
      .eq("is_active", true)
      .single() as { data: any }

    if (!workingHour) {
      // Professional does not work on this day
      return { success: true, data: [] }
    }

    // 3. Fetch Agenda Settings
    const { data: settings } = await (supabase.from("agenda_settings") as any).select("*").limit(1).single() as { data: any }
    const slotInterval = settings?.slot_interval_minutes || 30
    const allowOverbooking = settings?.allow_overbooking || false

    // 4. Fetch Appointments for the day
    const startOfDay = `${date}T00:00:00-03:00`
    const endOfDay = `${date}T23:59:59-03:00`

    const { data: appointments } = await supabase
      .from("appointments")
      .select("start_at, end_at, status")
      .eq("professional_id", professionalId)
      .gte("start_at", startOfDay)
      .lte("start_at", endOfDay)
      .not("status", "in", '("cancelled","no_show")') as { data: any[] | null }

    // 5. Fetch Blocks for the day
    const { data: blocks } = await supabase
      .from("appointment_blocks")
      .select("start_at, end_at")
      .eq("professional_id", professionalId)
      .eq("is_active", true)
      .gte("start_at", startOfDay)
      .lte("start_at", endOfDay) as { data: any[] | null }

    // 6. Generate Slots
    // Parse times
    const [startHour, startMin] = workingHour.start_time.split(":").map(Number)
    const [endHour, endMin] = workingHour.end_time.split(":").map(Number)
    
    let breakStartMins = -1
    let breakEndMins = -1
    if (workingHour.break_start_time && workingHour.break_end_time) {
      const [bsH, bsM] = workingHour.break_start_time.split(":").map(Number)
      const [beH, beM] = workingHour.break_end_time.split(":").map(Number)
      breakStartMins = bsH * 60 + bsM
      breakEndMins = beH * 60 + beM
    }

    const startMins = startHour * 60 + startMin
    const endMins = endHour * 60 + endMin

    const slots: Slot[] = []
    
    // Determine current time in São Paulo timezone to prevent booking past slots
    const now = new Date()
    const spFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    const nowDateSP = spFormatter.format(now) // yyyy-mm-dd in São Paulo
    const isToday = nowDateSP === date
    // Get current hour/minute in São Paulo
    const spTimeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', minute: 'numeric', hour12: false })
    const timeParts = spTimeFormatter.formatToParts(now)
    const currentHour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0')
    const currentMinute = parseInt(timeParts.find(p => p.type === 'minute')?.value || '0')
    const currentMins = currentHour * 60 + currentMinute

    for (let currentSlotMins = startMins; currentSlotMins + duration <= endMins; currentSlotMins += slotInterval) {
      const slotStartMins = currentSlotMins
      const slotEndMins = currentSlotMins + duration

      // Ignore slots in the past if it's today
      if (isToday && slotStartMins <= currentMins) {
        continue
      }

      // Check break conflict
      if (breakStartMins !== -1 && breakEndMins !== -1) {
        if (slotStartMins < breakEndMins && slotEndMins > breakStartMins) {
          continue // Conflics with break
        }
      }

      // Convert slot times to Date objects for comparison
      const slotStartDate = new Date(targetDate)
      slotStartDate.setHours(Math.floor(slotStartMins / 60), slotStartMins % 60, 0, 0)
      
      const slotEndDate = new Date(targetDate)
      slotEndDate.setHours(Math.floor(slotEndMins / 60), slotEndMins % 60, 0, 0)

      const slotStartIso = slotStartDate.toISOString()
      const slotEndIso = slotEndDate.toISOString()

      // Check blocks
      const hasBlock = blocks?.some(b => {
        const bStart = new Date(b.start_at).toISOString()
        const bEnd = new Date(b.end_at).toISOString()
        return bStart < slotEndIso && bEnd > slotStartIso
      })

      if (hasBlock) {
        continue // Blocked
      }

      // Check appointments
      const hasConflict = appointments?.some(a => {
        const aStart = new Date(a.start_at).toISOString()
        const aEnd = new Date(a.end_at).toISOString()
        return aStart < slotEndIso && aEnd > slotStartIso
      })

      if (hasConflict && !allowOverbooking) {
        continue // Conflict
      }

      // If we got here, slot is available
      const h = Math.floor(slotStartMins / 60).toString().padStart(2, '0')
      const m = (slotStartMins % 60).toString().padStart(2, '0')
      
      slots.push({
        time: `${h}:${m}`,
        available: true
      })
    }

    return { success: true, data: slots }

  } catch (error: any) {
    console.error("getCustomerAvailableSlots error:", error)
    return { success: false, error: error.message || "Erro interno ao buscar disponibilidade." }
  }
}
