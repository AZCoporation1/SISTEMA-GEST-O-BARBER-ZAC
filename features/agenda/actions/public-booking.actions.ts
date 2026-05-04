"use server"

/**
 * Public booking actions — used by the customer booking portal (/cliente).
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS for public-facing catalog queries.
 * Returns ONLY safe, non-sensitive data fields.
 */

import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Public Booking Professionals ────────────────────────────

export interface PublicProfessional {
  id: string
  displayName: string
  role: string
}

/**
 * Fetch active professionals (barbeiros) for the public booking flow.
 * Uses the same filter as the internal agenda: role = 'barbeiro'.
 * Only returns id, display name, and role — no sensitive data.
 */
export async function getPublicBookingProfessionals(): Promise<{
  success: boolean
  data?: PublicProfessional[]
  error?: string
}> {
  try {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from("collaborators")
      .select("id, name, display_name, role")
      .eq("is_active", true)
      .eq("role", "barbeiro")
      .order("name")

    if (error) {
      console.error("getPublicBookingProfessionals error:", error)
      return { success: false, error: "Erro ao carregar profissionais." }
    }

    if (!data || data.length === 0) {
      return { success: true, data: [] }
    }

    // Normalize to safe public shape
    const professionals: PublicProfessional[] = data.map((p: any) => ({
      id: p.id,
      displayName: p.display_name || p.name || 'Profissional',
      role: 'Profissional',  // Normalize role label — don't expose internal role values
    }))

    return { success: true, data: professionals }
  } catch (err: any) {
    console.error("getPublicBookingProfessionals unexpected error:", err)
    return { success: false, error: "Erro interno ao carregar profissionais." }
  }
}

// ── Validate Service for Public Booking ─────────────────────

export interface PublicService {
  id: string
  name: string
  price: number
  durationMinutes: number
}

export async function getPublicBookingService(serviceId: string): Promise<{
  success: boolean
  data?: PublicService
  error?: string
}> {
  try {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from("services")
      .select("id, name, price, duration_minutes, is_active, is_bookable")
      .eq("id", serviceId)
      .single()

    if (error || !data) {
      return { success: false, error: "Serviço não encontrado." }
    }

    if (!data.is_active || !data.is_bookable) {
      return { success: false, error: "Serviço indisponível para agendamento." }
    }

    return {
      success: true,
      data: {
        id: data.id,
        name: data.name,
        price: data.price,
        durationMinutes: data.duration_minutes,
      }
    }
  } catch (err: any) {
    console.error("getPublicBookingService error:", err)
    return { success: false, error: "Erro interno." }
  }
}

// ── Public Service Catalog ──────────────────────────────────

export interface PublicCatalogService {
  id: string
  name: string
  price: number
  durationMinutes: number
  categoryName: string
}

export async function getPublicBookingCatalog(): Promise<{
  success: boolean
  data?: PublicCatalogService[]
  error?: string
}> {
  try {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from("services")
      .select("id, name, duration_minutes, price, is_active, is_bookable, service_categories(name)")
      .eq("is_active", true)
      .eq("is_bookable", true)
      .gt("duration_minutes", 0)
      .order("name")

    if (error) {
      console.error("getPublicBookingCatalog error:", error)
      return { success: false, error: "Erro ao carregar serviços." }
    }

    if (!data || data.length === 0) {
      return { success: true, data: [] }
    }

    const catalog: PublicCatalogService[] = data.map((s: any) => ({
      id: s.id,
      name: s.name,
      price: s.price || 0,
      durationMinutes: s.duration_minutes,
      categoryName: s.service_categories?.name || 'Geral',
    }))

    return { success: true, data: catalog }
  } catch (err: any) {
    console.error("getPublicBookingCatalog error:", err)
    return { success: false, error: "Erro interno." }
  }
}
