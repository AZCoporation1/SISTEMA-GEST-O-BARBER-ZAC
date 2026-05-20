"use client"

import { createClient } from "@/lib/supabase/client"
import type {
  AppointmentRow,
  AppointmentBlockRow,
  AgendaSettingsRow,
  ProfessionalWorkingHoursRow,
  AppointmentWaitlistRow,
  AppointmentCommandItemRow,
  AppointmentWithRelations,
  ProfessionalForAgenda,
} from "../types"

const supabase = createClient()

// ── Appointments ─────────────────────────────────────────

export async function fetchAppointmentsByDate(
  date: string,
  professionalId?: string
): Promise<AppointmentWithRelations[]> {
  const startOfDay = `${date}T00:00:00-03:00`
  const endOfDay = `${date}T23:59:59-03:00`

  let query = supabase
    .from("appointments")
    .select(`
      *,
      professional:collaborators!appointments_professional_id_fkey(id, name, display_name),
      customer:customers(id, full_name, phone),
      service:services(id, name, price, duration_minutes)
    `)
    .gte("start_at", startOfDay)
    .lte("start_at", endOfDay)
    .not("status", "eq", "cancelled")
    .order("start_at", { ascending: true })

  if (professionalId) {
    query = query.eq("professional_id", professionalId)
  }

  const { data, error } = await query

  if (error) {
    console.error("Fetch appointments error:", error)
    return []
  }

  return (data as any) || []
}

export async function fetchAllAppointmentsByDate(date: string): Promise<AppointmentWithRelations[]> {
  return fetchAppointmentsByDate(date)
}

// ── Blocks ───────────────────────────────────────────────

export async function fetchBlocksByDate(date: string): Promise<AppointmentBlockRow[]> {
  const startOfDay = `${date}T00:00:00-03:00`
  const endOfDay = `${date}T23:59:59-03:00`

  const { data, error } = await supabase
    .from("appointment_blocks")
    .select("*")
    .eq("is_active", true)
    .gte("start_at", startOfDay)
    .lte("start_at", endOfDay)

  if (error) {
    console.error("Fetch blocks error:", error)
    return []
  }

  return (data as any) || []
}

// ── Settings ─────────────────────────────────────────────

export async function fetchAgendaSettings(): Promise<AgendaSettingsRow | null> {
  const { data, error } = await supabase
    .from("agenda_settings")
    .select("*")
    .limit(1)
    .single()

  if (error) return null
  return data as any
}

// ── Working Hours ────────────────────────────────────────

export async function fetchProfessionalHours(
  professionalId?: string
): Promise<ProfessionalWorkingHoursRow[]> {
  let query = supabase
    .from("professional_working_hours")
    .select("*")
    .eq("is_active", true)
    .order("weekday", { ascending: true })

  if (professionalId) {
    query = query.eq("professional_id", professionalId)
  }

  const { data, error } = await query

  if (error) {
    console.error("Fetch working hours error:", error)
    return []
  }

  return (data as any) || []
}

// ── Professionals ────────────────────────────────────────

export async function fetchProfessionals(): Promise<ProfessionalForAgenda[]> {
  const { data, error } = await supabase
    .from("collaborators")
    .select("id, name, display_name, is_active, default_commission_percent")
    .eq("is_active", true)
    .eq("role", "barbeiro")
    .order("name")

  if (error) {
    console.error("Fetch professionals error:", error)
    return []
  }

  return (data as any) || []
}

// ── Services (bookable only) ────────────────────────────

export async function fetchBookableServices() {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, price, duration_minutes, commission_percent")
    .eq("is_active", true)
    .eq("is_bookable", true)
    .order("name")

  if (error) {
    console.error("Fetch services error:", error)
    return []
  }

  return data || []
}

// ── Products for comanda (EXCLUDING PERF) ───────────────

export async function fetchProductsForComanda() {
  const { data, error } = await supabase
    .from("inventory_products")
    .select("id, name, external_code, sale_price_generated, current_qty, cost_price")
    .eq("is_active", true)
    .gt("current_qty", 0)
    .order("name")

  if (error) {
    console.error("Fetch products error:", error)
    return []
  }

  // ── CRITICAL: Exclude PERF products (Vista/Prazo motor is separate) ──
  return (data || []).filter((p: any) =>
    !p.external_code || !String(p.external_code).toUpperCase().startsWith("PERF")
  )
}

// ── Customers ────────────────────────────────────────────

export async function searchCustomers(search: string) {
  if (!search || search.length < 2) return []

  const normalized = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name, phone, mobile_phone")
    .or(`normalized_name.ilike.%${normalized}%,phone.ilike.%${search}%,mobile_phone.ilike.%${search}%`)
    .eq("is_active", true)
    .limit(10)

  if (error) return []
  return data || []
}

// ── Waitlist ─────────────────────────────────────────────

export async function fetchWaitlist(statusFilter?: string): Promise<AppointmentWaitlistRow[]> {
  let query = supabase
    .from("appointment_waitlist")
    .select("*")
    .order("created_at", { ascending: true })

  if (statusFilter) {
    query = query.eq("status", statusFilter)
  } else {
    // Default: show non-cancelled
    query = query.not("status", "eq", "cancelled")
  }

  const { data, error } = await query

  if (error) return []
  return (data as any) || []
}

// ── Command Items ────────────────────────────────────────

export async function fetchCommandItems(appointmentId: string): Promise<AppointmentCommandItemRow[]> {
  const { data, error } = await supabase
    .from("appointment_command_items")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: true })

  if (error) return []
  return (data as any) || []
}

// ── Conflict Check ───────────────────────────────────────

export async function checkConflict(
  professionalId: string,
  startAt: string,
  endAt: string,
  excludeId?: string
): Promise<boolean> {
  let query = supabase
    .from("appointments")
    .select("id")
    .eq("professional_id", professionalId)
    .not("status", "in", '("cancelled","no_show")')
    .lt("start_at", endAt)
    .gt("end_at", startAt)

  if (excludeId) {
    query = query.neq("id", excludeId)
  }

  const { data } = await query
  return (data?.length || 0) > 0
}

// ── Payment Methods ──────────────────────────────────────

export async function fetchPaymentMethods() {
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, name")
    .eq("is_active", true)
    .order("name")

  if (error) return []
  return data || []
}

// ── Cancelled Appointments (for internal notification) ────

export interface CancelledAppointmentInfo {
  id: string
  customer_name_snapshot: string | null
  service_name_snapshot: string | null
  start_at: string
  end_at: string
  cancellation_reason: string | null
  cancelled_at: string | null
  professional_id: string
  professional: { name: string } | null
}

export async function fetchCancelledAppointmentsByDate(date: string): Promise<CancelledAppointmentInfo[]> {
  const startOfDay = `${date}T00:00:00-03:00`
  const endOfDay = `${date}T23:59:59-03:00`

  const { data, error } = await supabase
    .from("appointments")
    .select(`
      id, customer_name_snapshot, service_name_snapshot,
      start_at, end_at, cancellation_reason, cancelled_at, professional_id,
      professional:collaborators!appointments_professional_id_fkey(name)
    `)
    .eq("status", "cancelled")
    .gte("start_at", startOfDay)
    .lte("start_at", endOfDay)
    .not("cancellation_reason", "is", null)
    .order("cancelled_at", { ascending: false })
    .limit(20)

  if (error) {
    console.error("Fetch cancelled appointments error:", error)
    return []
  }

  return (data as any) || []
}
