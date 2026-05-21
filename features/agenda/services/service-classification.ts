/**
 * Barber Zac ERP — Service Classification Engine
 *
 * Helper puro (sem side-effects) para classificação inteligente de serviços.
 * Retorna 3 camadas: category_id principal, displayCategories e tags.
 *
 * NÃO altera banco. NÃO faz queries. Apenas analisa dados em memória.
 */

// ── Types ────────────────────────────────────────────────

export interface ServiceClassificationInput {
  id: string
  name: string
  description?: string | null
  price: number | null
  duration_minutes: number | null
  is_active: boolean
  is_bookable: boolean
  category_id?: string | null
}

export interface ServiceClassification {
  isCombo: boolean
  canBeMain: boolean
  canBeAddon: boolean
  primaryCategorySlug: string
  displayCategories: string[]
  tags: string[]
  confidence: "high" | "medium" | "low"
  reason: string
  needsManualReview: boolean
  /** Service should be hidden from public funnel (R$0, administrative, etc.) */
  shouldHideFromPublicFunnel: boolean
  hideReason?: string
}

// ── Category Slugs (Professional Final) ──────────────────

export const CATEGORY_SLUGS = {
  COMBOS_PRONTOS: "combos-prontos",
  CORTES_DE_CABELO: "cortes-de-cabelo",
  BARBA_E_BIGODE: "barba-e-bigode",
  SOBRANCELHA_E_DEPILACAO: "sobrancelha-e-depilacao",
  ESTETICA_E_BEM_ESTAR: "estetica-e-bem-estar",
  QUIMICAS_E_COLORACAO: "quimicas-e-coloracao",
  TRATAMENTOS_CAPILARES: "tratamentos-capilares",
  FINALIZACAO_E_PENTEADOS: "finalizacao-e-penteados",
  CONSULTORIA_E_EDUCACAO: "consultoria-e-educacao",
  ATENDIMENTO_ESPECIAL: "atendimento-especial",
  OUTROS: "outros",
} as const

export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  [CATEGORY_SLUGS.COMBOS_PRONTOS]: "Combos Prontos",
  [CATEGORY_SLUGS.CORTES_DE_CABELO]: "Cortes de Cabelo",
  [CATEGORY_SLUGS.BARBA_E_BIGODE]: "Barba e Bigode",
  [CATEGORY_SLUGS.SOBRANCELHA_E_DEPILACAO]: "Sobrancelha e Depilação",
  [CATEGORY_SLUGS.ESTETICA_E_BEM_ESTAR]: "Estética e Bem-estar",
  [CATEGORY_SLUGS.QUIMICAS_E_COLORACAO]: "Químicas e Coloração",
  [CATEGORY_SLUGS.TRATAMENTOS_CAPILARES]: "Tratamentos Capilares",
  [CATEGORY_SLUGS.FINALIZACAO_E_PENTEADOS]: "Finalização e Penteados",
  [CATEGORY_SLUGS.CONSULTORIA_E_EDUCACAO]: "Consultoria e Educação",
  [CATEGORY_SLUGS.ATENDIMENTO_ESPECIAL]: "Atendimento Especial",
  [CATEGORY_SLUGS.OUTROS]: "Outros",
}

// ── Keyword Maps ─────────────────────────────────────────

const KEYWORD_GROUPS = {
  combo: /combo|pacote/,
  corte: /corte|degrade|social|executivo|fade|tesoura|texturizacao|zac|infantil|pezinho cabelo|pezinho|passar a maquina/,
  barba: /barba|barboterapia|terapia de barba|razor|aparar barba|cavanhaque|pezinho barba/,
  bigode: /bigode/,
  sobrancelha: /sobrancelha|sombrancelha/,
  depilacao: /cera nasal|nazal|nasal|orelha|depilacao|apenugem|limpeza orelha|raspagem.*(costas|peito)/,
  estetica: /limpeza de pele|massoterapia|remocao de cravos|ozonio|estetica|facial|skin care|detox/,
  quimica: /progressiva|alisamento|alissamento|luzes|reflexo|nevou|platinado|tintura|colorimetria|mechas|selagem|botox|pintura black|pintura colors|pintura.*artistica|camuflagem|pigmentacao|micropigmentacao|colors fun/,
  tratamento: /hidratacao|reconstrucao|mascara|tratamento|cauterizacao|nutricao|acidificacao|sos reconstrutor|lavagem|lavatorio/,
  finalizacao: /penteado|finalizacao/,
  consultoria: /consultoria|aula particular|metodo tbe|visagista|abordagem visagista|entrega.*(certificado)/,
  especial: /emergencial/,
} as const

// Display category names for each keyword group
const GROUP_DISPLAY_CATEGORIES: Record<string, string[]> = {
  corte: ["Cabelo"],
  barba: ["Barba e Bigode"],
  bigode: ["Barba e Bigode"],
  sobrancelha: ["Sobrancelha e Depilação"],
  depilacao: ["Sobrancelha e Depilação"],
  estetica: ["Estética e Bem-estar"],
  quimica: ["Químicas e Coloração"],
  tratamento: ["Tratamentos Capilares"],
  finalizacao: ["Finalização e Penteados"],
  consultoria: ["Consultoria e Educação"],
  especial: ["Atendimento Especial"],
}

// Group → primary slug mapping
const GROUP_PRIMARY_SLUG: Record<string, string> = {
  corte: CATEGORY_SLUGS.CORTES_DE_CABELO,
  barba: CATEGORY_SLUGS.BARBA_E_BIGODE,
  bigode: CATEGORY_SLUGS.BARBA_E_BIGODE,
  sobrancelha: CATEGORY_SLUGS.SOBRANCELHA_E_DEPILACAO,
  depilacao: CATEGORY_SLUGS.SOBRANCELHA_E_DEPILACAO,
  estetica: CATEGORY_SLUGS.ESTETICA_E_BEM_ESTAR,
  quimica: CATEGORY_SLUGS.QUIMICAS_E_COLORACAO,
  tratamento: CATEGORY_SLUGS.TRATAMENTOS_CAPILARES,
  finalizacao: CATEGORY_SLUGS.FINALIZACAO_E_PENTEADOS,
  consultoria: CATEGORY_SLUGS.CONSULTORIA_E_EDUCACAO,
  especial: CATEGORY_SLUGS.ATENDIMENTO_ESPECIAL,
}

// ── Specific Service Overrides ───────────────────────────
// For services that can't be classified by keywords alone.
// Keyed by normalized name.

interface ServiceOverride {
  slug: string
  displayCategories: string[]
  tags: string[]
  confidence: "high" | "medium" | "low"
  needsManualReview: boolean
  shouldHideFromPublicFunnel: boolean
  hideReason?: string
  reason: string
}

const SERVICE_OVERRIDES: Record<string, ServiceOverride> = {
  "abordagem visagista": {
    slug: CATEGORY_SLUGS.CONSULTORIA_E_EDUCACAO,
    displayCategories: ["Consultoria e Visagismo"],
    tags: ["visagismo", "consultoria", "imagem"],
    confidence: "medium",
    needsManualReview: true,
    shouldHideFromPublicFunnel: true,
    hideReason: "Serviço de consultoria — exibir no funil público só com aprovação",
    reason: "Override: Abordagem Visagista → Consultoria e Educação",
  },
  "consultoria particular (aula)": {
    slug: CATEGORY_SLUGS.CONSULTORIA_E_EDUCACAO,
    displayCategories: ["Consultoria e Educação"],
    tags: ["aula", "consultoria", "educacao"],
    confidence: "high",
    needsManualReview: true,
    shouldHideFromPublicFunnel: true,
    hideReason: "Serviço educacional — ocultar do funil público",
    reason: "Override: Consultoria particular → Consultoria e Educação",
  },
  "metodo tbe - aula particular": {
    slug: CATEGORY_SLUGS.CONSULTORIA_E_EDUCACAO,
    displayCategories: ["Consultoria e Educação"],
    tags: ["aula", "tbe", "educacao", "mentoria"],
    confidence: "high",
    needsManualReview: true,
    shouldHideFromPublicFunnel: true,
    hideReason: "Serviço educacional — ocultar do funil público",
    reason: "Override: Metodo TBE → Consultoria e Educação",
  },
  "emergencial": {
    slug: CATEGORY_SLUGS.ATENDIMENTO_ESPECIAL,
    displayCategories: ["Atendimento Especial"],
    tags: ["emergencial", "urgente", "especial"],
    confidence: "high",
    needsManualReview: true,
    shouldHideFromPublicFunnel: false,
    reason: "Override: Emergencial → Atendimento Especial",
  },
  "entrega do certificado": {
    slug: CATEGORY_SLUGS.CONSULTORIA_E_EDUCACAO,
    displayCategories: ["Consultoria e Educação"],
    tags: ["certificado", "administrativo"],
    confidence: "high",
    needsManualReview: true,
    shouldHideFromPublicFunnel: true,
    hideReason: "Administrativo + preço R$0 — is_bookable=false recomendado",
    reason: "Override: Entrega do certificado → Consultoria e Educação (administrativo)",
  },
  "lavagem": {
    slug: CATEGORY_SLUGS.TRATAMENTOS_CAPILARES,
    displayCategories: ["Tratamentos Capilares", "Finalização e Penteados"],
    tags: ["lavagem", "lavatorio", "tratamento"],
    confidence: "medium",
    needsManualReview: false,
    shouldHideFromPublicFunnel: false,
    reason: "Override: Lavagem → Tratamentos Capilares",
  },
  "penteado": {
    slug: CATEGORY_SLUGS.FINALIZACAO_E_PENTEADOS,
    displayCategories: ["Finalização e Penteados"],
    tags: ["penteado", "finalizacao"],
    confidence: "high",
    needsManualReview: false,
    shouldHideFromPublicFunnel: false,
    reason: "Override: Penteado → Finalização e Penteados",
  },
  "pintura colors fun": {
    slug: CATEGORY_SLUGS.QUIMICAS_E_COLORACAO,
    displayCategories: ["Químicas e Coloração"],
    tags: ["pintura", "coloracao", "colors-fun", "tintura", "cor"],
    confidence: "high",
    needsManualReview: false,
    shouldHideFromPublicFunnel: false,
    reason: "Override: Pintura colors fun → Químicas e Coloração",
  },
  "raspagem / costas & peito": {
    slug: CATEGORY_SLUGS.SOBRANCELHA_E_DEPILACAO,
    displayCategories: ["Sobrancelha e Depilação", "Estética e Bem-estar"],
    tags: ["raspagem", "costas", "peito", "depilacao", "remocao-de-pelos"],
    confidence: "medium",
    needsManualReview: false,
    shouldHideFromPublicFunnel: false,
    reason: "Override: Raspagem Costas/Peito → Sobrancelha e Depilação",
  },
}

// ── Addon Detection ──────────────────────────────────────

const ADDON_KEYWORDS = /sobrancelha|sombrancelha|bigode|cera nasal|nazal|nasal|orelha|depilacao|apenugem|limpeza orelha|lavagem|finalizacao/

const MAIN_SERVICE_KEYWORDS = /corte|barba|barboterapia|progressiva|alisamento|alissamento|luzes|reflexo|nevou|platinado|limpeza de pele|hidratacao|selagem|tintura|colorimetria|micropigmentacao|abordagem visagista/

// ── Normalize ────────────────────────────────────────────

function normalize(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00A0/g, " ")    // non-breaking space → normal space
    .replace(/&amp;/g, "&")
    .replace(/&/g, "&")
    .trim()
}

// ── Main Classification Function ─────────────────────────

export function classifyService(service: ServiceClassificationInput): ServiceClassification {
  const name = normalize(service.name)
  const desc = normalize(service.description || "")
  const combined = `${name} ${desc}`

  // ── Step 0: Check specific overrides ──
  const override = SERVICE_OVERRIDES[name]
  if (override) {
    const isCombo = KEYWORD_GROUPS.combo.test(name)
    const canBeMain = isCombo || MAIN_SERVICE_KEYWORDS.test(name)
    const canBeAddon = !isCombo && ADDON_KEYWORDS.test(name)

    let shouldHide = override.shouldHideFromPublicFunnel
    let hideReason = override.hideReason

    // Also hide if price is 0
    if (service.price === 0 || service.price === null) {
      shouldHide = true
      hideReason = (hideReason ? hideReason + " | " : "") + "Preço R$0"
    }

    return {
      isCombo,
      canBeMain,
      canBeAddon,
      primaryCategorySlug: override.slug,
      displayCategories: override.displayCategories,
      tags: override.tags,
      confidence: override.confidence,
      reason: override.reason,
      needsManualReview: override.needsManualReview,
      shouldHideFromPublicFunnel: shouldHide,
      hideReason,
    }
  }

  // ── Step 1: Detect combo ──
  const isCombo = KEYWORD_GROUPS.combo.test(name)

  // ── Step 2: Detect matched keyword groups ──
  const matchedGroups: string[] = []
  const matchedTags: string[] = []

  for (const [group, regex] of Object.entries(KEYWORD_GROUPS)) {
    if (group === "combo") continue
    if (regex.test(combined)) {
      matchedGroups.push(group)
      matchedTags.push(group)
    }
  }

  // ── Step 3: Build displayCategories from matched groups ──
  const displayCategories: string[] = []
  for (const group of matchedGroups) {
    const cats = GROUP_DISPLAY_CATEGORIES[group]
    if (cats) {
      for (const cat of cats) {
        if (!displayCategories.includes(cat)) {
          displayCategories.push(cat)
        }
      }
    }
  }

  // ── Step 4: Determine primary category ──
  let primaryCategorySlug: string
  let confidence: "high" | "medium" | "low" = "high"
  let reason: string
  let needsManualReview = false

  if (isCombo) {
    primaryCategorySlug = CATEGORY_SLUGS.COMBOS_PRONTOS
    matchedTags.unshift("combo")
    reason = `Nome contém "combo/pacote". DisplayCategories derivadas dos componentes internos.`
  } else if (matchedGroups.length === 1) {
    const group = matchedGroups[0]
    primaryCategorySlug = GROUP_PRIMARY_SLUG[group] || CATEGORY_SLUGS.OUTROS
    reason = `Classificado por palavra-chave: ${group}.`
  } else if (matchedGroups.length > 1) {
    const primary = matchedGroups[0]
    primaryCategorySlug = GROUP_PRIMARY_SLUG[primary] || CATEGORY_SLUGS.OUTROS
    confidence = "medium"
    reason = `Múltiplas palavras-chave detectadas (${matchedGroups.join(", ")}). Primary: ${primary}.`
  } else {
    // No keywords matched — truly unknown
    primaryCategorySlug = CATEGORY_SLUGS.OUTROS
    confidence = "low"
    needsManualReview = true
    reason = `Nenhuma palavra-chave reconhecida. Requer revisão manual.`
  }

  // ── Step 5: Determine main/addon role ──
  const canBeMain = isCombo || MAIN_SERVICE_KEYWORDS.test(name)
  const canBeAddon = !isCombo && ADDON_KEYWORDS.test(name)

  // ── Step 6: Public funnel visibility ──
  let shouldHideFromPublicFunnel = false
  let hideReason: string | undefined

  if (service.price === 0 || service.price === null) {
    shouldHideFromPublicFunnel = true
    hideReason = "Preço R$0 — revisar antes de incluir no funil público"
    needsManualReview = true
    if (confidence === "high") confidence = "medium"
    reason += ` Preço R$0.`
  }

  return {
    isCombo,
    canBeMain,
    canBeAddon,
    primaryCategorySlug,
    displayCategories,
    tags: matchedTags,
    confidence,
    reason,
    needsManualReview,
    shouldHideFromPublicFunnel,
    hideReason,
  }
}

// ── Name Normalization Suggestions ───────────────────────

export interface NameNormalizationSuggestion {
  currentName: string
  suggestedName: string
  reason: string
}

export function suggestNameNormalization(name: string): NameNormalizationSuggestion | null {
  const checks: Array<{ pattern: RegExp; replacement: string; reason: string }> = [
    { pattern: /Sombrancelha/i, replacement: "Sobrancelha", reason: "Erro de grafia" },
    { pattern: /Premiun/i, replacement: "Premium", reason: "Erro de grafia" },
    { pattern: /&amp;/g, replacement: "&", reason: "HTML entity no nome" },
    { pattern: /Combo\.(\d)/g, replacement: "Combo $1", reason: "Padronização de separador" },
    { pattern: /recontru/i, replacement: "reconstru", reason: "Erro de grafia" },
    { pattern: /sellagem/i, replacement: "selagem", reason: "Erro de grafia" },
    { pattern: /sollution/i, replacement: "solution", reason: "Erro de grafia" },
    { pattern: /colors fun/i, replacement: "Colors Fun", reason: "Padronização de nome" },
  ]

  let suggested = name
  const reasons: string[] = []

  for (const check of checks) {
    if (check.pattern.test(suggested)) {
      suggested = suggested.replace(check.pattern, check.replacement)
      reasons.push(check.reason)
    }
  }

  if (suggested !== name) {
    return {
      currentName: name,
      suggestedName: suggested,
      reason: reasons.join("; "),
    }
  }

  return null
}
