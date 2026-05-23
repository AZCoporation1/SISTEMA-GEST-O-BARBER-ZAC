/**
 * Barber Zac ERP — Service Composition Engine
 *
 * Calculates total price, operational duration, and display name
 * for composed services (main + addons).
 *
 * NÃO altera banco. NÃO faz queries. Apenas calcula em memória.
 * Backend DEVE usar este helper para revalidar dados do front.
 */

import { classifyService, type ServiceClassificationInput } from "./service-classification"

// ── Types ────────────────────────────────────────────────

export interface CompositionServiceInput {
  id: string
  name: string
  price: number
  duration_minutes: number
  is_active: boolean
  is_bookable: boolean
  description?: string | null
  category_id?: string | null
}

export interface ServiceCompositionInput {
  mainService: CompositionServiceInput
  addons?: CompositionServiceInput[]
}

export interface ServiceCompositionResult {
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
  serviceIds: string[]
  displayCategories: string[]
  tags: string[]
  warnings: string[]
}

export interface OperationalDurationResult {
  totalMinutes: number
  rule: string
  isCustomRule: boolean
}

// ── Normalize for comparison ─────────────────────────────

function norm(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00A0/g, " ")    // non-breaking space → normal space
    .replace(/&amp;/g, "&")
    .replace(/&/g, "&")
    .trim()
}

// ── Operational Duration Rules ───────────────────────────
// Rules confirmed by the business owner:
// - Corte + Sobrancelha = 30min
// - Corte + Barba = 60min
// - Corte + Barba + Sobrancelha = 60min
// - Combo pronto = própria duração
// - Química = própria duração
// - Sem regra = soma simples + warning

const CORTE_KEYWORDS = /corte|degrade|social|executivo|fade|tesoura|texturizacao|zac/
const BARBA_KEYWORDS = /barba|barboterapia/
const SOBRANCELHA_KEYWORDS = /sobrancelha|sombrancelha|bigode|cera nasal|nazal|nasal|orelha|depilacao|apenugem|limpeza orelha/

interface DurationRule {
  /** Returns true if this rule matches the given main + addons combination */
  match: (mainName: string, addonNames: string[]) => boolean
  /** The fixed operational duration in minutes */
  minutes: number
  /** Human-readable description of the rule */
  description: string
}

const DURATION_RULES: DurationRule[] = [
  {
    // Corte + Sobrancelha (or similar) = 30min
    match: (main, addons) => {
      const hasCorte = CORTE_KEYWORDS.test(main)
      const allAddonsAreSobrancelha = addons.length > 0 && addons.every(a => SOBRANCELHA_KEYWORDS.test(a))
      const noBarba = !addons.some(a => BARBA_KEYWORDS.test(a))
      return hasCorte && allAddonsAreSobrancelha && noBarba
    },
    minutes: 30,
    description: "Corte + Sobrancelha/Depilação = 30min",
  },
  {
    // Corte + Barba = 60min
    match: (main, addons) => {
      const hasCorte = CORTE_KEYWORDS.test(main)
      const hasBarba = addons.some(a => BARBA_KEYWORDS.test(a))
      const noSobrancelha = !addons.some(a => SOBRANCELHA_KEYWORDS.test(a))
      return hasCorte && hasBarba && noSobrancelha
    },
    minutes: 60,
    description: "Corte + Barba = 60min",
  },
  {
    // Corte + Barba + Sobrancelha = 60min
    match: (main, addons) => {
      const hasCorte = CORTE_KEYWORDS.test(main)
      const hasBarba = addons.some(a => BARBA_KEYWORDS.test(a))
      const hasSobrancelha = addons.some(a => SOBRANCELHA_KEYWORDS.test(a))
      return hasCorte && hasBarba && hasSobrancelha
    },
    minutes: 60,
    description: "Corte + Barba + Sobrancelha = 60min",
  },
]

/**
 * Resolve the operational duration for a service composition.
 * Uses business-confirmed rules, falling back to simple sum with warning.
 */
export function resolveOperationalDuration(
  mainService: CompositionServiceInput,
  addons: CompositionServiceInput[] = []
): OperationalDurationResult {
  // No addons → use main service duration
  if (addons.length === 0) {
    return {
      totalMinutes: mainService.duration_minutes,
      rule: "Serviço individual — duração própria",
      isCustomRule: false,
    }
  }

  // Check if it's a combo (should not have addons in v1, but handle gracefully)
  const mainClassification = classifyService(mainService as ServiceClassificationInput)
  if (mainClassification.isCombo) {
    return {
      totalMinutes: mainService.duration_minutes,
      rule: "Combo pronto — duração própria (adicionais ignorados)",
      isCustomRule: false,
    }
  }

  // Normalize names for rule matching
  const mainName = norm(mainService.name)
  const addonNames = addons.map(a => norm(a.name))

  // Try each rule
  for (const rule of DURATION_RULES) {
    if (rule.match(mainName, addonNames)) {
      return {
        totalMinutes: rule.minutes,
        rule: rule.description,
        isCustomRule: true,
      }
    }
  }

  // Fallback: simple sum
  const sumMinutes = mainService.duration_minutes + addons.reduce((sum, a) => sum + a.duration_minutes, 0)
  return {
    totalMinutes: sumMinutes,
    rule: `Soma simples (sem regra operacional específica): ${mainService.duration_minutes} + ${addons.map(a => a.duration_minutes).join(" + ")} = ${sumMinutes}min`,
    isCustomRule: false,
  }
}

// ── Compatibility Validation ─────────────────────────────

const QUIMICA_KEYWORDS = /progressiva|alisamento|alissamento|luzes|reflexo|nevou|platinado|tintura|colorimetria|mechas|selagem|botox/

/**
 * Categories that should NEVER appear in the public booking funnel.
 * Backend uses this to reject direct URL access attempts.
 */
const BLOCKED_PUBLIC_CATEGORY_SLUGS = new Set([
  "consultoria-e-educacao",
  "atendimento-especial",
  "planos-mensais",
])

/**
 * Check if a service is safe for the public booking funnel.
 * Returns false if it should be blocked (hidden, R$0, admin, etc).
 */
export function isServicePublicFunnelSafe(service: CompositionServiceInput): { safe: boolean; reason?: string } {
  if (!service.is_active) return { safe: false, reason: "Serviço inativo." }
  if (!service.is_bookable) return { safe: false, reason: "Serviço não agendável." }
  if (service.price === 0 || service.price === null) return { safe: false, reason: "Serviço com preço R$0." }
  if (!service.duration_minutes || service.duration_minutes <= 0) return { safe: false, reason: "Serviço sem duração." }

  const classification = classifyService(service as ServiceClassificationInput)
  if (classification.shouldHideFromPublicFunnel) {
    return { safe: false, reason: classification.hideReason || "Serviço ocultável do funil público." }
  }
  if (classification.needsManualReview) {
    return { safe: false, reason: "Serviço em revisão manual." }
  }
  if (BLOCKED_PUBLIC_CATEGORY_SLUGS.has(classification.primaryCategorySlug)) {
    return { safe: false, reason: `Categoria "${classification.primaryCategorySlug}" bloqueada do funil público.` }
  }

  return { safe: true }
}

export interface CompatibilityResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate compatibility between a main service and addons.
 * Returns errors if combination is not allowed.
 * This is called by the backend — NEVER trust front-end validation alone.
 */
export function validateCompositionCompatibility(
  mainService: CompositionServiceInput,
  addons: CompositionServiceInput[] = []
): CompatibilityResult {
  const errors: string[] = []

  // Rule 1: Combo pronto does NOT accept addons (v1)
  const mainClassification = classifyService(mainService as ServiceClassificationInput)
  if (mainClassification.isCombo && addons.length > 0) {
    errors.push("Combos prontos não aceitam adicionais nesta versão.")
  }

  // Rule 2: No química + química without explicit rule
  const mainIsQuimica = QUIMICA_KEYWORDS.test(norm(mainService.name))
  const quimicaAddons = addons.filter(a => QUIMICA_KEYWORDS.test(norm(a.name)))
  if (mainIsQuimica && quimicaAddons.length > 0) {
    errors.push(`Química + Química não permitido sem regra de compatibilidade: ${quimicaAddons.map(a => a.name).join(", ")}`)
  }

  // Rule 3: Each addon must NOT be a combo
  for (const addon of addons) {
    const addonClassification = classifyService(addon as ServiceClassificationInput)
    if (addonClassification.isCombo) {
      errors.push(`"${addon.name}" é um combo e não pode ser usado como adicional.`)
    }
  }

  // Rule 4: All services must be active and bookable
  if (!mainService.is_active || !mainService.is_bookable) {
    errors.push(`Serviço principal "${mainService.name}" não está ativo ou agendável.`)
  }
  for (const addon of addons) {
    if (!addon.is_active || !addon.is_bookable) {
      errors.push(`Adicional "${addon.name}" não está ativo ou agendável.`)
    }
  }

  // Rule 5: Price R$0 services should not be in public funnel
  if (mainService.price === 0) {
    errors.push(`Serviço principal "${mainService.name}" tem preço R$0 — necessita revisão.`)
  }
  for (const addon of addons) {
    if (addon.price === 0 || addon.price === null) {
      errors.push(`Adicional "${addon.name}" tem preço R$0.`)
    }
  }

  // Rule 6: No duplicate addons
  const addonIds = addons.map(a => a.id)
  const uniqueAddonIds = new Set(addonIds)
  if (uniqueAddonIds.size !== addonIds.length) {
    errors.push("Adicionais duplicados não são permitidos.")
  }

  // Rule 7: Addon cannot be the same as main service
  for (const addon of addons) {
    if (addon.id === mainService.id) {
      errors.push("Adicional não pode ser igual ao serviço principal.")
    }
  }

  // Rule 8: No hidden/review services as addons
  for (const addon of addons) {
    const safety = isServicePublicFunnelSafe(addon)
    if (!safety.safe) {
      errors.push(`Adicional "${addon.name}" não pode ser usado: ${safety.reason}`)
    }
  }

  // Rule 9: Main service must be safe for public funnel
  const mainSafety = isServicePublicFunnelSafe(mainService)
  if (!mainSafety.safe) {
    errors.push(`Serviço principal "${mainService.name}" não pode ser agendado online: ${mainSafety.reason}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// ── Suggested Addons Engine ──────────────────────────────
// Defines which services can be offered as addons for each main service category.
// Two tiers: "addon leve" (quick complements) and "serviço secundário forte" (can be main too).

/**
 * Given a main service and all available services, returns categorized addon suggestions.
 * Barba/Limpeza de pele are "serviço secundário forte" — they are canBeMain but also
 * selectable as addon for compatible main services.
 */
export function getSuggestedAddons(
  mainService: CompositionServiceInput,
  allServices: CompositionServiceInput[]
): { light: CompositionServiceInput[]; strong: CompositionServiceInput[] } {
  const mainClassification = classifyService(mainService as ServiceClassificationInput)
  const mainName = norm(mainService.name)

  // Combos don't accept addons
  if (mainClassification.isCombo) {
    return { light: [], strong: [] }
  }

  const light: CompositionServiceInput[] = []
  const strong: CompositionServiceInput[] = []

  const isMainCorte = CORTE_KEYWORDS.test(mainName)
  const isMainBarba = BARBA_KEYWORDS.test(mainName)
  const isMainQuimica = QUIMICA_KEYWORDS.test(mainName)
  const isMainEstetica = /limpeza de pele|skin care|massoterapia|detox/.test(mainName)

  for (const svc of allServices) {
    // Skip self
    if (svc.id === mainService.id) continue
    // Skip inactive/unbookable/zero-price
    const safety = isServicePublicFunnelSafe(svc)
    if (!safety.safe) continue

    const svcClassification = classifyService(svc as ServiceClassificationInput)
    // Skip combos
    if (svcClassification.isCombo) continue

    const svcName = norm(svc.name)
    const isSvcSobrancelha = SOBRANCELHA_KEYWORDS.test(svcName)
    const isSvcBarba = BARBA_KEYWORDS.test(svcName)
    const isSvcCorte = CORTE_KEYWORDS.test(svcName)
    const isSvcEstetica = /limpeza de pele|skin care|massoterapia|detox/.test(svcName)
    const isSvcTratamento = /hidratacao|reconstrucao|acidificacao|lavagem/.test(svcName)
    const isSvcQuimica = QUIMICA_KEYWORDS.test(svcName)
    const isSvcFinalizacao = /penteado|finalizacao/.test(svcName)

    if (isMainCorte) {
      // Corte: sobrancelha/bigode/depilação = leve; barba/limpeza de pele/hidratação = forte
      if (isSvcSobrancelha) { light.push(svc); continue }
      if (isSvcBarba) { strong.push(svc); continue }
      if (isSvcEstetica) { strong.push(svc); continue }
      if (isSvcTratamento) { strong.push(svc); continue }
      if (isSvcFinalizacao) { light.push(svc); continue }
    } else if (isMainBarba) {
      // Barba: sobrancelha = leve; corte/limpeza de pele = forte
      if (isSvcSobrancelha) { light.push(svc); continue }
      if (isSvcCorte) { strong.push(svc); continue }
      if (isSvcEstetica) { strong.push(svc); continue }
    } else if (isMainEstetica) {
      // Estética: sobrancelha = leve; corte/barba = forte
      if (isSvcSobrancelha) { light.push(svc); continue }
      if (isSvcCorte) { strong.push(svc); continue }
      if (isSvcBarba) { strong.push(svc); continue }
    } else if (isMainQuimica) {
      // Química: tratamentos = forte (hidratação, reconstrução); finalização = leve
      // No química + química
      if (isSvcQuimica) continue
      if (isSvcTratamento) { strong.push(svc); continue }
      if (isSvcFinalizacao) { light.push(svc); continue }
    } else if (isSvcTratamento) {
      // Tratamento as main: finalização = leve
      if (isSvcFinalizacao) { light.push(svc); continue }
    } else {
      // Generic: offer sobrancelha as leve
      if (isSvcSobrancelha) { light.push(svc); continue }
    }
  }

  return { light, strong }
}

// ── Main Composition Calculator ──────────────────────────

/**
 * Calculate the full composition of a service booking.
 * This is the SOURCE OF TRUTH for price, duration, and display name.
 * Backend MUST use this — never trust front-end calculations.
 */
export function calculateServiceComposition(input: ServiceCompositionInput): ServiceCompositionResult {
  const { mainService, addons = [] } = input
  const warnings: string[] = []

  // ── Classify main service ──
  const mainClassification = classifyService(mainService as ServiceClassificationInput)

  // ── Price calculation ──
  let totalPrice: number
  if (mainClassification.isCombo) {
    // Combo pronto uses its own price
    totalPrice = mainService.price
    if (addons.length > 0) {
      warnings.push("Combos prontos não aceitam adicionais. Adicionais foram ignorados no preço.")
    }
  } else {
    // Main + sum of addons
    totalPrice = mainService.price + addons.reduce((sum, a) => sum + a.price, 0)
  }

  // ── Duration calculation ──
  const effectiveAddons = mainClassification.isCombo ? [] : addons
  const durationResult = resolveOperationalDuration(mainService, effectiveAddons)

  if (!durationResult.isCustomRule && effectiveAddons.length > 0) {
    warnings.push(`Duração calculada por soma simples (sem regra operacional). ${durationResult.rule}`)
  }

  // ── Display name ──
  let displayName: string
  if (effectiveAddons.length === 0) {
    displayName = mainService.name
  } else {
    displayName = `${mainService.name} + ${effectiveAddons.map(a => a.name).join(" + ")}`
  }

  // ── Build items list ──
  const items = [
    {
      id: mainService.id,
      name: mainService.name,
      price: mainService.price,
      durationMinutes: mainService.duration_minutes,
      role: "main" as const,
    },
    ...effectiveAddons.map(a => ({
      id: a.id,
      name: a.name,
      price: a.price,
      durationMinutes: a.duration_minutes,
      role: "addon" as const,
    })),
  ]

  // ── Collect displayCategories and tags from all services ──
  const allDisplayCategories: string[] = []
  const allTags: string[] = []

  for (const svc of [mainService, ...effectiveAddons]) {
    const classification = classifyService(svc as ServiceClassificationInput)
    for (const cat of classification.displayCategories) {
      if (!allDisplayCategories.includes(cat)) allDisplayCategories.push(cat)
    }
    for (const tag of classification.tags) {
      if (!allTags.includes(tag)) allTags.push(tag)
    }
  }

  return {
    totalPrice,
    totalDurationMinutes: durationResult.totalMinutes,
    displayName,
    items,
    serviceIds: items.map(i => i.id),
    displayCategories: allDisplayCategories,
    tags: allTags,
    warnings,
  }
}
