"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Clock, DollarSign, Search, ChevronRight, ChevronDown,
  Scissors, Sparkles, Plus, Check, Loader2, X, Star, AlertTriangle,
  Flame, Heart, Wand2, Eye, Droplets, Paintbrush, Hand, PenTool,
  TrendingUp
} from 'lucide-react'
import type { PublicCatalogServiceV2, PublicAddonSuggestion } from '@/features/agenda/actions/public-booking.actions'
import { getPublicBookingSuggestedAddons, getPublicBookingComposition } from '@/features/agenda/actions/public-booking.actions'

// ── Category icon resolver (enhanced) ──
function getCategoryIcon(slug: string) {
  switch (slug) {
    case 'cortes-de-cabelo': return <Scissors className="w-5 h-5" />
    case 'barba-e-bigode': return <Scissors className="w-5 h-5" />
    case 'sobrancelha-e-depilacao': return <Eye className="w-5 h-5" />
    case 'estetica-e-bem-estar': return <Sparkles className="w-5 h-5" />
    case 'quimicas-e-coloracao': return <Paintbrush className="w-5 h-5" />
    case 'tratamentos-capilares': return <Droplets className="w-5 h-5" />
    case 'finalizacao-e-penteados': return <Wand2 className="w-5 h-5" />
    default: return <Scissors className="w-5 h-5" />
  }
}

// Resolve icon by service name for richer visual mapping
function resolveServiceIcon(name: string, slug: string) {
  const n = (name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  if (/barba|barboterapia|razor|cavanhaque|bigode/.test(n)) return <Scissors className="w-5 h-5" />
  if (/sobrancelha/.test(n)) return <Eye className="w-5 h-5" />
  if (/limpeza|pele|skin|estetica|facial/.test(n)) return <Sparkles className="w-5 h-5" />
  if (/hidratacao|tratamento|reconstrucao|cauterizacao/.test(n)) return <Droplets className="w-5 h-5" />
  if (/luzes|reflexo|nevou|platinado|coloracao|tintura|mechas/.test(n)) return <Paintbrush className="w-5 h-5" />
  if (/alisamento|progressiva|botox|selagem|quimica/.test(n)) return <Wand2 className="w-5 h-5" />
  if (/massoterapia|massagem/.test(n)) return <Hand className="w-5 h-5" />
  if (/depilacao|cera|nasal|orelha/.test(n)) return <Sparkles className="w-5 h-5" />
  if (/pigmentacao|micropigmentacao/.test(n)) return <PenTool className="w-5 h-5" />
  return getCategoryIcon(slug)
}

// ── Categories visible in "Montar Atendimento" ──
const VISIBLE_CATEGORIES = [
  'cortes-de-cabelo',
  'barba-e-bigode',
  'sobrancelha-e-depilacao',
  'estetica-e-bem-estar',
  'tratamentos-capilares',
  'quimicas-e-coloracao',
  'finalizacao-e-penteados',
]

const CATEGORY_LABELS: Record<string, string> = {
  'cortes-de-cabelo': 'Cortes de Cabelo',
  'barba-e-bigode': 'Barba e Bigode',
  'sobrancelha-e-depilacao': 'Sobrancelha e Depilação',
  'estetica-e-bem-estar': 'Estética e Bem-estar',
  'quimicas-e-coloracao': 'Químicas e Coloração',
  'tratamentos-capilares': 'Tratamentos Capilares',
  'finalizacao-e-penteados': 'Finalização e Penteados',
}

// ── Popularity ranking (deterministic — no analytics field in DB) ──
// Service names in DB use formats like:
//   "Corte (Degrade) // Gustavo ou Matheus"
//   "Barba&Terapia (30min)"
//   "Corte Zac"
// Normalization strips ALL non-alphanumeric chars, collapses spaces.
// Each keyword entry is a list of tokens that must ALL appear in the name (AND logic).
const POPULAR_ENTRIES = [
  ['corte', 'degrade', 'gustavo', 'matheus'],  // Corte (Degrade) // Gustavo ou Matheus
  ['corte', 'gustavo', 'gulu'],                // Corte (Degrade) // Gustavo e Gulu
  ['corte', 'degrade'],                        // Corte (Degrade) - Zac (fallback genérico)
  ['corte', 'zac'],                            // Corte Zac
  ['barba'],                                   // Barba ou Barba&Terapia
  ['barboterapia'],                            // Barboterapia
  ['sobrancelha'],                             // Sobrancelha
  ['limpeza', 'pele'],                         // Limpeza de Pele
  ['hidratacao'],                              // Hidratação
  ['alisamento'],                              // Alisamento
]

/** Normalize for comparison: lowercase, strip accents, remove ALL non-alphanumeric, collapse spaces */
function normalizeForCompare(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Check if all tokens appear in the normalized name */
function matchesAllTokens(normalizedName: string, tokens: string[]): boolean {
  return tokens.every(token => normalizedName.includes(token))
}

function resolvePopularServices(services: PublicCatalogServiceV2[]): PublicCatalogServiceV2[] {
  const popular: PublicCatalogServiceV2[] = []
  const usedIds = new Set<string>()

  for (const tokens of POPULAR_ENTRIES) {
    if (popular.length >= 8) break

    const match = services.find(s =>
      !usedIds.has(s.id) && matchesAllTokens(normalizeForCompare(s.name), tokens)
    )

    if (match) {
      popular.push(match)
      usedIds.add(match.id)
    }
  }

  return popular
}

// Format price to BRL
function formatPrice(price: number): string {
  return price.toFixed(2).replace('.', ',')
}

interface BuildServiceFlowProps {
  services: PublicCatalogServiceV2[]
  onBack: () => void
}

export default function BuildServiceFlow({ services, onBack }: BuildServiceFlowProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedMain, setSelectedMain] = useState<PublicCatalogServiceV2 | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<PublicAddonSuggestion[]>([])
  const [suggestedAddons, setSuggestedAddons] = useState<PublicAddonSuggestion[]>([])
  const [loadingAddons, setLoadingAddons] = useState(false)
  const [composition, setComposition] = useState<{
    totalPrice: number
    totalDurationMinutes: number
    displayName: string
  } | null>(null)
  const [loadingComposition, setLoadingComposition] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [allServicesSearch, setAllServicesSearch] = useState('')
  const [showAllServices, setShowAllServices] = useState(false)
  /** Visual warning when addons are removed due to main service swap */
  const [removedAddonsWarning, setRemovedAddonsWarning] = useState<string | null>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Filter eligible main services: non-combo, non-plan, canBeMain, visible categories
  const mainServices = useMemo(() =>
    services.filter(s =>
      !s.isCombo &&
      !s.isPlan &&
      s.canBeMain &&
      VISIBLE_CATEGORIES.includes(s.categorySlug)
    ), [services])

  // Popular services (deterministic)
  const popularServices = useMemo(() => resolvePopularServices(mainServices), [mainServices])

  // Group services by category for "Todos os serviços"
  const servicesByCategory = useMemo(() => {
    const groups: Record<string, PublicCatalogServiceV2[]> = {}
    const eligible = services.filter(s =>
      !s.isCombo &&
      !s.isPlan &&
      VISIBLE_CATEGORIES.includes(s.categorySlug)
    )

    // Filter by search
    const filtered = allServicesSearch
      ? eligible.filter(s => s.displayName.toLowerCase().includes(allServicesSearch.toLowerCase()))
      : eligible

    for (const svc of filtered) {
      const cat = svc.categorySlug
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(svc)
    }
    return groups
  }, [services, allServicesSearch])

  // Load suggested addons when main is selected
  const loadAddons = useCallback(async (mainId: string) => {
    setLoadingAddons(true)
    try {
      const res = await getPublicBookingSuggestedAddons(mainId)
      if (res.success && res.data) {
        setSuggestedAddons(res.data)
      }
    } catch { /* silent */ }
    setLoadingAddons(false)
  }, [])

  // Load composition when addons change
  useEffect(() => {
    if (!selectedMain) return
    setLoadingComposition(true)
    const timer = setTimeout(async () => {
      try {
        const res = await getPublicBookingComposition(
          selectedMain.id,
          selectedAddons.map(a => a.id)
        )
        if (res.success && res.data) {
          setComposition({
            totalPrice: res.data.totalPrice,
            totalDurationMinutes: res.data.totalDurationMinutes,
            displayName: res.data.displayName,
          })
        }
      } catch { /* silent */ }
      setLoadingComposition(false)
    }, 200)
    return () => clearTimeout(timer)
  }, [selectedMain, selectedAddons])

  const handleSelectMain = async (svc: PublicCatalogServiceV2) => {
    const previousMain = selectedMain
    setRemovedAddonsWarning(null)

    // If switching main and has addons, check compatibility
    if (previousMain && previousMain.id !== svc.id && selectedAddons.length > 0) {
      // Load new suggestions first, then reconcile
      setSelectedMain(svc)
      setComposition(null)
      setLoadingAddons(true)

      try {
        const res = await getPublicBookingSuggestedAddons(svc.id)
        if (res.success && res.data) {
          setSuggestedAddons(res.data)

          // Check which current addons are still compatible
          const newAddonIds = new Set(res.data.map(a => a.id))
          const compatible = selectedAddons.filter(a => newAddonIds.has(a.id))
          const removed = selectedAddons.filter(a => !newAddonIds.has(a.id))

          setSelectedAddons(compatible)

          if (removed.length > 0) {
            const names = removed.map(a => a.displayName).join(', ')
            setRemovedAddonsWarning(
              `Alguns adicionais foram removidos porque não combinam com o novo serviço principal: ${names}`
            )
            // Auto-dismiss after 6 seconds
            setTimeout(() => setRemovedAddonsWarning(null), 6000)
          }
        } else {
          setSuggestedAddons([])
          setSelectedAddons([])
        }
      } catch {
        setSuggestedAddons([])
        setSelectedAddons([])
      }
      setLoadingAddons(false)
    } else {
      // First selection or same service
      setSelectedMain(svc)
      setComposition(null)
      if (!previousMain || previousMain.id !== svc.id) {
        setSelectedAddons([])
        await loadAddons(svc.id)
      }
    }

    // Scroll to suggestions after a brief delay
    setTimeout(() => {
      suggestionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
  }

  const toggleAddon = (addon: PublicAddonSuggestion) => {
    setSelectedAddons(prev => {
      const exists = prev.find(a => a.id === addon.id)
      if (exists) return prev.filter(a => a.id !== addon.id)
      return [...prev, addon]
    })
  }

  // Add a service from "All services" as addon
  const addServiceAsAddon = (svc: PublicCatalogServiceV2) => {
    if (!selectedMain) {
      // If no main selected, select as main
      handleSelectMain(svc)
      return
    }
    if (svc.id === selectedMain.id) return // Can't add main as addon

    // Check if already in addons
    if (selectedAddons.some(a => a.id === svc.id)) {
      // Remove it
      setSelectedAddons(prev => prev.filter(a => a.id !== svc.id))
      return
    }

    // Add as addon
    const addon: PublicAddonSuggestion = {
      id: svc.id,
      name: svc.name,
      displayName: svc.displayName,
      price: svc.price,
      durationMinutes: svc.durationMinutes,
      tier: 'strong',
    }
    setSelectedAddons(prev => [...prev, addon])
  }

  const handleContinue = () => {
    if (!selectedMain) return
    const addonsParam = selectedAddons.length > 0
      ? `&addons=${selectedAddons.map(a => a.id).join(',')}`
      : ''
    router.push(`/cliente/agendar/profissional?serviceId=${selectedMain.id}${addonsParam}`)
  }

  const toggleCategory = (slug: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const isAddonSelected = (id: string) => selectedAddons.some(a => a.id === id)
  const isServiceSelected = (id: string) => selectedMain?.id === id || isAddonSelected(id)

  return (
    <div className="space-y-6 pb-36">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 fade-up-fast">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors btn-press">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Monte seu atendimento</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedMain
              ? 'Adicione complementos ou escolha outro serviço principal.'
              : 'Escolha um serviço principal e veja sugestões que combinam.'
            }
          </p>
        </div>
      </div>

      {/* ── Mais Pedidos (always visible) ── */}
      {popularServices.length > 0 && (
        <div className="space-y-3 fade-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-foreground">Mais pedidos</h2>
          </div>
          <div className="flex overflow-x-auto pb-2 -mx-4 px-4 snap-x hide-scrollbar gap-3">
            {popularServices.map((svc, idx) => {
              const isSelected = selectedMain?.id === svc.id
              return (
                <button
                  key={svc.id}
                  onClick={() => handleSelectMain(svc)}
                  className={`snap-center shrink-0 w-48 p-3.5 rounded-2xl border text-left group transition-all duration-200 btn-press
                    ${isSelected
                      ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                      : 'border-border bg-card/50 premium-card hover:border-primary/20'}`}
                  style={{ animationDelay: `${Math.min(idx * 40, 200)}ms` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all
                      ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground group-hover:text-foreground'}`}>
                      {resolveServiceIcon(svc.name, svc.categorySlug)}
                    </div>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-bold uppercase tracking-wide">
                      <Star className="w-2.5 h-2.5" /> Popular
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug mb-1.5">
                    {svc.displayName}
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {svc.durationMinutes}min
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      R$ {formatPrice(svc.price)}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-primary font-semibold">
                      <Check className="w-3 h-3" /> Selecionado
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Addon removal warning ── */}
      {removedAddonsWarning && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm text-amber-700 dark:text-amber-300 fade-up-fast">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-relaxed">{removedAddonsWarning}</p>
          </div>
          <button
            onClick={() => setRemovedAddonsWarning(null)}
            className="p-1 rounded hover:bg-amber-500/10 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Selected Main Service Card ── */}
      {selectedMain && (
        <div ref={suggestionsRef} className="space-y-2 fade-up-fast">
          <div className="p-4 rounded-2xl border border-primary/30 bg-primary/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide">
              Principal
            </div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                {resolveServiceIcon(selectedMain.name, selectedMain.categorySlug)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm line-clamp-1">{selectedMain.displayName}</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{selectedMain.durationMinutes}min</span>
                  <span className="flex items-center gap-1 font-semibold text-foreground"><DollarSign className="w-3 h-3" />R$ {formatPrice(selectedMain.price)}</span>
                </div>
              </div>
              <button
                onClick={() => { setSelectedMain(null); setSelectedAddons([]); setSuggestedAddons([]); setComposition(null); setRemovedAddonsWarning(null) }}
                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
                title="Remover serviço principal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Smart Suggestions ── */}
      {selectedMain && (
        <div className="space-y-4 fade-up" style={{ animationDelay: '100ms' }}>
          {loadingAddons ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Buscando sugestões...</span>
            </div>
          ) : suggestedAddons.length === 0 ? (
            <div className="text-center py-4 space-y-1 fade-up-fast">
              <p className="text-sm text-muted-foreground">Nenhum complemento disponível para este serviço.</p>
            </div>
          ) : (
            <>
              {/* Strong addons — "Sugestões para completar" */}
              {suggestedAddons.filter(a => a.tier === 'strong').length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-semibold text-foreground">Sugestões para completar</h3>
                  </div>
                  <div className="space-y-2">
                    {suggestedAddons.filter(a => a.tier === 'strong').map(addon => {
                      const isSelected = isAddonSelected(addon.id)
                      return (
                        <button
                          key={addon.id}
                          onClick={() => toggleAddon(addon)}
                          className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all duration-200 btn-press
                            ${isSelected
                              ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                              : 'border-border bg-card/50 hover:border-primary/20 premium-card'}`}
                        >
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all
                            ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'}`}>
                            {isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground text-sm leading-snug">{addon.displayName}</h4>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {addon.reasonLabel && (
                                <span className="text-[11px] text-primary/80 font-medium">
                                  {addon.reasonLabel}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                                <Heart className="w-2.5 h-2.5" /> Recomendado
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{addon.durationMinutes}min</span>
                              <span className="flex items-center gap-1 font-semibold text-foreground">+ R$ {formatPrice(addon.price)}</span>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Light addons — "Adicione se quiser" */}
              {suggestedAddons.filter(a => a.tier === 'light').length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Complementos rápidos</h3>
                  </div>
                  <div className="space-y-2">
                    {suggestedAddons.filter(a => a.tier === 'light').map(addon => {
                      const isSelected = isAddonSelected(addon.id)
                      return (
                        <button
                          key={addon.id}
                          onClick={() => toggleAddon(addon)}
                          className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-all duration-200 btn-press
                            ${isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-card/50 hover:border-primary/20'}`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all
                            ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'}`}>
                            {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground text-sm leading-snug">{addon.displayName}</h4>
                            {addon.reasonLabel && (
                              <p className="text-[10px] text-muted-foreground/80 mt-0.5">{addon.reasonLabel}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">{addon.durationMinutes}min</p>
                            <p className="text-xs font-medium text-foreground">+ R$ {formatPrice(addon.price)}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Divider ── */}
      {selectedMain && suggestedAddons.length > 0 && (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">ou escolha abaixo</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {/* ── All Services (if no main selected, show as main list) ── */}
      {!selectedMain && (
        <div className="space-y-4 fade-up" style={{ animationDelay: '100ms' }}>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar serviço..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-background border border-input rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-all duration-200"
            />
          </div>

          {/* Services grouped by category */}
          {VISIBLE_CATEGORIES.map(slug => {
            const catServices = mainServices.filter(s => {
              const matchSlug = s.categorySlug === slug
              const matchSearch = !search || s.displayName.toLowerCase().includes(search.toLowerCase())
              return matchSlug && matchSearch
            })
            if (catServices.length === 0) return null
            const popularIds = new Set(popularServices.map(p => p.id))

            return (
              <div key={slug} className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  {getCategoryIcon(slug)}
                  <h3 className="text-xs font-semibold uppercase tracking-wider">{CATEGORY_LABELS[slug] || slug}</h3>
                  <span className="text-[10px] text-muted-foreground/60">{catServices.length}</span>
                </div>
                <div className="space-y-2">
                  {catServices.map((svc, idx) => (
                    <button
                      key={svc.id}
                      onClick={() => handleSelectMain(svc)}
                      className="w-full p-3.5 rounded-2xl border border-border bg-card/50 premium-card hover:border-primary/20 flex items-center gap-3 group transition-all duration-200 btn-press"
                    >
                      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-accent text-muted-foreground group-hover:text-foreground group-hover:bg-primary/10 transition-all duration-200">
                        {resolveServiceIcon(svc.name, svc.categorySlug)}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-semibold text-foreground text-sm line-clamp-1 leading-snug">{svc.displayName}</h4>
                          {popularIds.has(svc.id) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-bold shrink-0">
                              <Star className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{svc.durationMinutes}min</span>
                          <span className="flex items-center gap-1 font-medium"><DollarSign className="w-3 h-3" />{formatPrice(svc.price)}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground icon-nudge shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Empty state */}
          {mainServices.filter(s => !search || s.displayName.toLowerCase().includes(search.toLowerCase())).length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground text-sm fade-up-fast">
              <Scissors className="w-10 h-10 opacity-30" />
              <p>Nenhum serviço encontrado.</p>
            </div>
          )}
        </div>
      )}

      {/* ── All Services Accordion (when main is selected) ── */}
      {selectedMain && (
        <div className="space-y-3 fade-up" style={{ animationDelay: '200ms' }}>
          <button
            onClick={() => setShowAllServices(!showAllServices)}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-border bg-card/50 hover:bg-accent/50 transition-all btn-press"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Todos os serviços</span>
              <span className="text-[10px] text-muted-foreground">
                {mainServices.length} disponíveis
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showAllServices ? 'rotate-180' : ''}`} />
          </button>

          {showAllServices && (
            <div className="space-y-3 fade-up-fast">
              {/* Search within all services */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar em todos os serviços..."
                  value={allServicesSearch}
                  onChange={e => setAllServicesSearch(e.target.value)}
                  className="w-full bg-background border border-input rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-all duration-200"
                />
              </div>

              {/* Category accordions */}
              {VISIBLE_CATEGORIES.map(slug => {
                const catServices = servicesByCategory[slug]
                if (!catServices || catServices.length === 0) return null
                const isExpanded = expandedCategories.has(slug)

                return (
                  <div key={slug} className="border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleCategory(slug)}
                      className="w-full flex items-center justify-between p-3 bg-card/50 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(slug)}
                        <span className="text-sm font-medium text-foreground">{CATEGORY_LABELS[slug] || slug}</span>
                        <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded-full">{catServices.length}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border divide-y divide-border">
                        {catServices.map(svc => {
                          const isMain = selectedMain?.id === svc.id
                          const isAddon = isAddonSelected(svc.id)
                          const selected = isMain || isAddon
                          return (
                            <button
                              key={svc.id}
                              onClick={() => {
                                if (isMain) return
                                addServiceAsAddon(svc)
                              }}
                              disabled={isMain}
                              className={`w-full p-3 text-left flex items-center gap-3 transition-all duration-150
                                ${isMain
                                  ? 'bg-primary/5 opacity-60 cursor-not-allowed'
                                  : isAddon
                                    ? 'bg-primary/5'
                                    : 'hover:bg-accent/30'}`}
                            >
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all
                                ${selected ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'}`}>
                                {selected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-foreground text-sm line-clamp-1">{svc.displayName}</h4>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{svc.durationMinutes}min</span>
                                  <span className="flex items-center gap-1 font-medium">R$ {formatPrice(svc.price)}</span>
                                </div>
                              </div>
                              {isMain && (
                                <span className="text-[10px] text-primary font-semibold shrink-0">Principal</span>
                              )}
                              {isAddon && (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">Adicionado</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Empty search state */}
              {Object.keys(servicesByCategory).length === 0 && allServicesSearch && (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground text-sm">
                  <Search className="w-8 h-8 opacity-30" />
                  <p>Nenhum serviço encontrado para &quot;{allServicesSearch}&quot;</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Sticky Bottom Cart ── */}
      {selectedMain && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border safe-area-bottom fade-up-fast">
          <div className="max-w-lg mx-auto p-4">
            {/* Selected addons pills */}
            {selectedAddons.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {selectedAddons.map(addon => (
                  <button
                    key={addon.id}
                    onClick={() => toggleAddon(addon)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium hover:bg-destructive/10 hover:text-destructive transition-colors btn-press group"
                  >
                    {addon.displayName}
                    <X className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            )}

            {/* Summary */}
            <div className="flex items-center justify-between mb-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Seu atendimento</p>
                <p className="text-sm font-semibold text-foreground line-clamp-1">
                  {loadingComposition ? '...' : (composition?.displayName || selectedMain.displayName)}
                </p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                  <Clock className="w-3 h-3" />
                  {loadingComposition ? '...' : `${composition?.totalDurationMinutes || selectedMain.durationMinutes}min`}
                </p>
                <p className="text-lg font-bold text-foreground">
                  R$ {loadingComposition ? '...' : formatPrice(composition?.totalPrice || selectedMain.price)}
                </p>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={handleContinue}
              disabled={loadingComposition}
              className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-primary text-primary-foreground font-semibold premium-cta hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {loadingComposition ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Scissors className="w-5 h-5" />
                  Escolher profissional
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
