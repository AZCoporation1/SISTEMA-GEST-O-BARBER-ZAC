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
  /** Optional override for composed services (main + addons). Uses service's own duration if omitted. */
  durationOverrideMinutes?: number
}

// ── In-memory cache for rarely-changing data ──
// These caches are per-serverless-instance and reset on redeploy
const CACHE_TTL_MS = 120_000 // 2 minutes

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const serviceCache = new Map<string, CacheEntry<any>>()
const settingsCache: { entry: CacheEntry<any> | null } = { entry: null }
const workingHoursCache = new Map<string, CacheEntry<any>>()

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data
  }
  return null
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T) {
  cache.set(key, { data, timestamp: Date.now() })
}

function buildSaoPauloDateTime(dateYmd: string, timeHHmm: string): Date {
  return new Date(`${dateYmd}T${timeHHmm}:00-03:00`)
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export async function getCustomerAvailableSlots({
  serviceId,
  professionalId,
  date,
  durationOverrideMinutes,
}: GetAvailableSlotsParams): Promise<{ success: boolean; data?: Slot[]; error?: string }> {
  try {
    // Use service role to bypass RLS — this is called from public customer routes
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // ── Ensure date is not in the past ──
    const currentDate = new Date()
    const todayStr = currentDate.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) // yyyy-mm-dd
    if (date < todayStr) {
      return { success: true, data: [] }
    }

    const targetDate = new Date(`${date}T00:00:00-03:00`)
    const weekday = targetDate.getDay() // 0 = Sunday, 1 = Monday, etc.
    const whCacheKey = `${professionalId}:${weekday}`

    // ── Batch 1: Cached data (service, settings, working hours) ──
    // Check caches first, only fetch what's missing
    let service = getCached(serviceCache, serviceId)
    let settings = settingsCache.entry && Date.now() - settingsCache.entry.timestamp < CACHE_TTL_MS
      ? settingsCache.entry.data : null
    let workingHour = getCached(workingHoursCache, whCacheKey)

    // Fetch only uncached items in parallel
    const fetchPromises: Promise<void>[] = []

    if (!service) {
      fetchPromises.push(
        (supabase.from("services") as any)
          .select("duration_minutes, is_active, is_bookable")
          .eq("id", serviceId)
          .single()
          .then(({ data, error }: any) => {
            if (!error && data) {
              service = data
              setCache(serviceCache, serviceId, data)
            }
          })
      )
    }

    if (!settings) {
      fetchPromises.push(
        (supabase.from("agenda_settings") as any)
          .select("*")
          .limit(1)
          .single()
          .then(({ data }: any) => {
            settings = data
            settingsCache.entry = { data, timestamp: Date.now() }
          })
      )
    }

    if (!workingHour) {
      fetchPromises.push(
        (supabase.from("professional_working_hours") as any)
          .select("*")
          .eq("professional_id", professionalId)
          .eq("weekday", weekday)
          .eq("is_active", true)
          .single()
          .then(({ data }: any) => {
            workingHour = data
            if (data) setCache(workingHoursCache, whCacheKey, data)
          })
      )
    }

    if (fetchPromises.length > 0) {
      await Promise.all(fetchPromises)
    }

    // ── Validate service ──
    if (!service) {
      return { success: false, error: "Serviço não encontrado." }
    }
    if (!service.is_active || !service.is_bookable) {
      return { success: false, error: "Serviço indisponível para agendamento." }
    }
    if (!service.duration_minutes) {
      return { success: false, error: "Serviço sem duração configurada." }
    }

    // Use override duration for composed services, or service's own duration
    const duration = durationOverrideMinutes && durationOverrideMinutes > 0
      ? durationOverrideMinutes
      : service.duration_minutes

    if (!workingHour) {
      // Professional does not work on this day
      return { success: true, data: [] }
    }

    const slotInterval = settings?.slot_interval_minutes || 30
    // FOR CLIENT AREA: We strictly ignore allow_overbooking to prevent double booking.
    const allowOverbooking = false 

    // ── Batch 2: Real-time data (appointments + blocks) — always fresh ──
    const startOfDay = `${date}T00:00:00-03:00`
    const endOfDay = `${date}T23:59:59-03:00`

    const [appointmentsRes, blocksRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("start_at, end_at, status")
        .eq("professional_id", professionalId)
        .gte("start_at", startOfDay)
        .lte("start_at", endOfDay)
        .not("status", "in", '("cancelled","no_show")'),
      supabase
        .from("appointment_blocks")
        .select("start_at, end_at")
        .eq("professional_id", professionalId)
        .eq("is_active", true)
        .gte("start_at", startOfDay)
        .lte("start_at", endOfDay),
    ])

    const appointments = appointmentsRes.data as any[] | null
    const blocks = blocksRes.data as any[] | null

    // ── Generate Slots ──
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

      // ── Convert slot times explicitly with -03:00 timezone ──
      const hStr = Math.floor(slotStartMins / 60).toString().padStart(2, '0')
      const mStr = (slotStartMins % 60).toString().padStart(2, '0')
      
      const slotStart = buildSaoPauloDateTime(date, `${hStr}:${mStr}`)
      const slotEnd = addMinutes(slotStart, duration)
      
      const slotStartMs = slotStart.getTime()
      const slotEndMs = slotEnd.getTime()

      // Check blocks
      const hasBlock = blocks?.some(b => {
        const bStartMs = new Date(b.start_at).getTime()
        const bEndMs = new Date(b.end_at).getTime()
        return bStartMs < slotEndMs && bEndMs > slotStartMs
      })

      if (hasBlock) {
        continue // Blocked
      }

      // Check appointments
      const hasConflict = appointments?.some(a => {
        const aStartMs = new Date(a.start_at).getTime()
        const aEndMs = new Date(a.end_at).getTime()
        return aStartMs < slotEndMs && aEndMs > slotStartMs
      })

      if (hasConflict && !allowOverbooking) {
        continue // Conflict
      }

      // If we got here, slot is available
      slots.push({
        time: `${hStr}:${mStr}`,
        available: true
      })
    }

    return { success: true, data: slots }

  } catch (error: any) {
    console.error("getCustomerAvailableSlots error:", error)
    return { success: false, error: error.message || "Erro interno ao buscar disponibilidade." }
  }
}
