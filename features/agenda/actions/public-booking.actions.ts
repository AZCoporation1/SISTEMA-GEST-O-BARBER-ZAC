"use server"

/**
 * Public booking actions — used by the customer booking portal (/cliente).
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS for public-facing catalog queries.
 * Returns ONLY safe, non-sensitive data fields.
 */

import { createClient } from '@supabase/supabase-js'
import {
  classifyService,
  type ServiceClassificationInput,
} from '@/features/agenda/services/service-classification'
import {
  calculateServiceComposition,
  validateCompositionCompatibility,
  isServicePublicFunnelSafe,
  getSuggestedAddons,
  type CompositionServiceInput,
} from '@/features/agenda/services/service-composition'

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
// Now includes security check against hidden services

export interface PublicService {
  id: string
  name: string
  price: number
  durationMinutes: number
}

/**
 * Fetch and validate a single service for public booking.
 * BLOCKS hidden, R$0, inactive, review-pending services even if accessed by direct URL.
 */
export async function getPublicBookingService(serviceId: string): Promise<{
  success: boolean
  data?: PublicService
  error?: string
}> {
  try {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from("services")
      .select("id, name, price, duration_minutes, is_active, is_bookable, description, category_id")
      .eq("id", serviceId)
      .single()

    if (error || !data) {
      return { success: false, error: "Serviço não encontrado." }
    }

    // Security: check if service is safe for public funnel
    const safety = isServicePublicFunnelSafe(data as CompositionServiceInput)
    if (!safety.safe) {
      return { success: false, error: safety.reason || "Serviço indisponível para agendamento." }
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

// ── Public Service Catalog (Legacy — kept for fallback) ─────

export interface PublicCatalogService {
  id: string
  name: string
  price: number
  durationMinutes: number
  categoryName: string
  description: string | null
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
      .select("id, name, description, duration_minutes, price, is_active, is_bookable, category_id, service_categories(name)")
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

    // Filter out hidden/review/R$0 services
    const catalog: PublicCatalogService[] = data
      .filter((s: any) => {
        const safety = isServicePublicFunnelSafe(s as CompositionServiceInput)
        return safety.safe
      })
      .map((s: any) => ({
        id: s.id,
        name: s.name,
        price: s.price || 0,
        durationMinutes: s.duration_minutes,
        categoryName: s.service_categories?.name || 'Geral',
        description: s.description || null,
      }))

    return { success: true, data: catalog }
  } catch (err: any) {
    console.error("getPublicBookingCatalog error:", err)
    return { success: false, error: "Erro interno." }
  }
}

// ── V2 Catalog — Full Classification Data ────────────────────

export interface PublicCatalogServiceV2 {
  id: string
  name: string
  /** Visual display name (normalizes Combo.X → Combo X, etc) */
  displayName: string
  price: number
  durationMinutes: number
  categoryName: string
  categorySlug: string
  description: string | null
  isCombo: boolean
  isPlan: boolean
  canBeMain: boolean
  displayCategories: string[]
  tags: string[]
}

/** Normalizes display name (visual only — Combo.10 → Combo 10, &amp; → &) */
function normalizeDisplayName(name: string): string {
  return name
    .replace(/Combo\./g, 'Combo ')
    .replace(/&amp;/g, '&')
}

export async function getPublicBookingCatalogV2(): Promise<{
  success: boolean
  data?: PublicCatalogServiceV2[]
  error?: string
}> {
  try {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from("services")
      .select("id, name, description, duration_minutes, price, is_active, is_bookable, category_id, service_categories(name)")
      .eq("is_active", true)
      .eq("is_bookable", true)
      .gt("duration_minutes", 0)
      .order("name")

    if (error) {
      console.error("getPublicBookingCatalogV2 error:", error)
      return { success: false, error: "Erro ao carregar serviços." }
    }

    if (!data || data.length === 0) {
      return { success: true, data: [] }
    }

    const catalog: PublicCatalogServiceV2[] = []
    for (const s of data as any[]) {
      const safety = isServicePublicFunnelSafe(s as CompositionServiceInput)
      if (!safety.safe) continue

      const classification = classifyService(s as ServiceClassificationInput)

      catalog.push({
        id: s.id,
        name: s.name,
        displayName: normalizeDisplayName(s.name),
        price: s.price || 0,
        durationMinutes: s.duration_minutes,
        categoryName: s.service_categories?.name || 'Geral',
        categorySlug: classification.primaryCategorySlug,
        description: s.description || null,
        isCombo: classification.isCombo,
        isPlan: classification.isPlan,
        canBeMain: classification.canBeMain,
        displayCategories: classification.displayCategories,
        tags: classification.tags,
      })
    }

    return { success: true, data: catalog }
  } catch (err: any) {
    console.error("getPublicBookingCatalogV2 error:", err)
    return { success: false, error: "Erro interno." }
  }
}

// ── Server-Side Composition Calculator ───────────────────────
// Used by data-hora and confirmacao pages to calculate composition on the server.

export interface PublicCompositionResult {
  totalPrice: number
  totalDurationMinutes: number
  displayName: string
  items: Array<{
    id: string
    name: string
    price: number
    durationMinutes: number
    role: "main" | "addon"
  }>
  warnings: string[]
}

/**
 * Calculate service composition on the server.
 * Returns validated price, duration, name. Backend is SOURCE OF TRUTH.
 */
export async function getPublicBookingComposition(
  serviceId: string,
  addonServiceIds: string[] = []
): Promise<{
  success: boolean
  data?: PublicCompositionResult
  error?: string
}> {
  try {
    const supabase = getAdminClient()

    // Fetch main service
    const { data: mainSvc, error: mainErr } = await supabase
      .from("services")
      .select("id, name, price, duration_minutes, is_active, is_bookable, description, category_id")
      .eq("id", serviceId)
      .single()

    if (mainErr || !mainSvc) {
      return { success: false, error: "Serviço principal não encontrado." }
    }

    // Security: validate main service is safe
    const mainSafety = isServicePublicFunnelSafe(mainSvc as CompositionServiceInput)
    if (!mainSafety.safe) {
      return { success: false, error: mainSafety.reason || "Serviço indisponível." }
    }

    let addonServices: CompositionServiceInput[] = []

    if (addonServiceIds.length > 0) {
      // Deduplicate addon IDs
      const uniqueAddonIds = [...new Set(addonServiceIds)]

      // Fetch addons
      const { data: addons, error: addonsErr } = await supabase
        .from("services")
        .select("id, name, price, duration_minutes, is_active, is_bookable, description, category_id")
        .in("id", uniqueAddonIds)

      if (addonsErr || !addons || addons.length !== uniqueAddonIds.length) {
        return { success: false, error: "Um ou mais adicionais não foram encontrados." }
      }

      addonServices = addons as CompositionServiceInput[]

      // Validate compatibility (includes all security rules)
      const compat = validateCompositionCompatibility(mainSvc as CompositionServiceInput, addonServices)
      if (!compat.valid) {
        return { success: false, error: compat.errors[0] }
      }
    }

    // Calculate composition
    const composition = calculateServiceComposition({
      mainService: mainSvc as CompositionServiceInput,
      addons: addonServices,
    })

    return {
      success: true,
      data: {
        totalPrice: composition.totalPrice,
        totalDurationMinutes: composition.totalDurationMinutes,
        displayName: composition.displayName,
        items: composition.items,
        warnings: composition.warnings,
      }
    }
  } catch (err: any) {
    console.error("getPublicBookingComposition error:", err)
    return { success: false, error: "Erro interno ao calcular composição." }
  }
}

// ── Suggested Addons for a Main Service ──────────────────────

export interface PublicAddonSuggestion {
  id: string
  name: string
  displayName: string
  price: number
  durationMinutes: number
  tier: "light" | "strong"
  /** Contextual label for UI microcopy (e.g. "Combina com Alisamento") */
  reasonLabel?: string
}

export async function getPublicBookingSuggestedAddons(
  mainServiceId: string
): Promise<{
  success: boolean
  data?: PublicAddonSuggestion[]
  error?: string
}> {
  try {
    const supabase = getAdminClient()

    // Fetch all active services
    const { data: allServices, error } = await supabase
      .from("services")
      .select("id, name, price, duration_minutes, is_active, is_bookable, description, category_id")
      .eq("is_active", true)
      .eq("is_bookable", true)
      .gt("duration_minutes", 0)
      .order("name")

    if (error || !allServices) {
      return { success: false, error: "Erro ao carregar serviços." }
    }

    const mainService = allServices.find((s: any) => s.id === mainServiceId) as CompositionServiceInput | undefined
    if (!mainService) {
      return { success: false, error: "Serviço principal não encontrado." }
    }

    const { light, strong, reasonMap } = getSuggestedAddons(mainService, allServices as CompositionServiceInput[])

    const suggestions: PublicAddonSuggestion[] = [
      ...strong.map(s => ({
        id: s.id,
        name: s.name,
        displayName: normalizeDisplayName(s.name),
        price: s.price,
        durationMinutes: s.duration_minutes,
        tier: "strong" as const,
        reasonLabel: reasonMap[s.id] || undefined,
      })),
      ...light.map(s => ({
        id: s.id,
        name: s.name,
        displayName: normalizeDisplayName(s.name),
        price: s.price,
        durationMinutes: s.duration_minutes,
        tier: "light" as const,
        reasonLabel: reasonMap[s.id] || undefined,
      })),
    ]

    return { success: true, data: suggestions }
  } catch (err: any) {
    console.error("getPublicBookingSuggestedAddons error:", err)
    return { success: false, error: "Erro interno." }
  }
}
