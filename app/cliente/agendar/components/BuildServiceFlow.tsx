"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, DollarSign, Search, ChevronRight, Scissors, Sparkles, Plus, Check, Loader2, X, ShoppingBag } from 'lucide-react'
import type { PublicCatalogServiceV2, PublicAddonSuggestion } from '@/features/agenda/actions/public-booking.actions'
import { getPublicBookingSuggestedAddons, getPublicBookingComposition } from '@/features/agenda/actions/public-booking.actions'

// ── Category icon resolver ──
function getCategoryIcon(slug: string) {
  switch (slug) {
    case 'cortes-de-cabelo': return <Scissors className="w-5 h-5" />
    case 'barba-e-bigode': return <Scissors className="w-5 h-5" />
    case 'sobrancelha-e-depilacao': return <Sparkles className="w-5 h-5" />
    case 'estetica-e-bem-estar': return <Sparkles className="w-5 h-5" />
    case 'quimicas-e-coloracao': return <Sparkles className="w-5 h-5" />
    case 'tratamentos-capilares': return <Sparkles className="w-5 h-5" />
    case 'finalizacao-e-penteados': return <Sparkles className="w-5 h-5" />
    default: return <Scissors className="w-5 h-5" />
  }
}

// ── Categories visible in "Montar Atendimento" ──
const VISIBLE_CATEGORIES = [
  'cortes-de-cabelo',
  'barba-e-bigode',
  'estetica-e-bem-estar',
  'quimicas-e-coloracao',
  'tratamentos-capilares',
  'finalizacao-e-penteados',
  'sobrancelha-e-depilacao',
]

const CATEGORY_LABELS: Record<string, string> = {
  'cortes-de-cabelo': 'Cabelo',
  'barba-e-bigode': 'Barba e Bigode',
  'estetica-e-bem-estar': 'Estética',
  'quimicas-e-coloracao': 'Químicas',
  'tratamentos-capilares': 'Tratamentos',
  'finalizacao-e-penteados': 'Finalização',
  'sobrancelha-e-depilacao': 'Depilação',
}

interface BuildServiceFlowProps {
  services: PublicCatalogServiceV2[]
  onBack: () => void
}

type FlowStep = 'select-main' | 'select-addons'

export default function BuildServiceFlow({ services, onBack }: BuildServiceFlowProps) {
  const router = useRouter()
  const [step, setStep] = useState<FlowStep>('select-main')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Todos')
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

  // Filter main services: non-combo, canBeMain, visible categories
  const mainServices = services.filter(s =>
    !s.isCombo &&
    s.canBeMain &&
    VISIBLE_CATEGORIES.includes(s.categorySlug)
  )

  // Available categories from actual data
  const availableCategories = ['Todos', ...VISIBLE_CATEGORIES.filter(slug =>
    mainServices.some(s => s.categorySlug === slug)
  ).map(slug => CATEGORY_LABELS[slug] || slug)]

  const categorySlugFromLabel = (label: string): string | null => {
    if (label === 'Todos') return null
    return Object.entries(CATEGORY_LABELS).find(([, v]) => v === label)?.[0] || null
  }

  const filtered = mainServices.filter(s => {
    const matchSearch = !search || s.displayName.toLowerCase().includes(search.toLowerCase())
    const slug = categorySlugFromLabel(activeCategory)
    const matchCategory = !slug || s.categorySlug === slug
    return matchSearch && matchCategory
  })

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
    setSelectedMain(svc)
    setSelectedAddons([])
    setStep('select-addons')
    await loadAddons(svc.id)
  }

  const toggleAddon = (addon: PublicAddonSuggestion) => {
    setSelectedAddons(prev => {
      const exists = prev.find(a => a.id === addon.id)
      if (exists) return prev.filter(a => a.id !== addon.id)
      return [...prev, addon]
    })
  }

  const handleContinue = () => {
    if (!selectedMain) return
    const addonsParam = selectedAddons.length > 0
      ? `&addons=${selectedAddons.map(a => a.id).join(',')}`
      : ''
    router.push(`/cliente/agendar/profissional?serviceId=${selectedMain.id}${addonsParam}`)
  }

  // ── Step 1: Select Main Service ──
  if (step === 'select-main') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 fade-up-fast">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors btn-press">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Montar Atendimento</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Escolha o serviço principal</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative fade-up-fast">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar serviço..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-background border border-input rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-all duration-200"
          />
        </div>

        {/* Category pills */}
        <div className="flex overflow-x-auto pb-2 -mx-4 px-4 snap-x hide-scrollbar gap-2">
          {availableCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`snap-center shrink-0 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border btn-press
                ${activeCategory === cat
                  ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Service list */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground text-sm fade-up-fast">
              <Scissors className="w-10 h-10 opacity-30" />
              <p>Nenhum serviço encontrado.</p>
            </div>
          ) : (
            filtered.map((svc, idx) => (
              <button
                key={svc.id}
                onClick={() => handleSelectMain(svc)}
                className="w-full p-4 rounded-2xl border border-border bg-card/50 premium-card hover:border-primary/20 flex items-center gap-4 group fade-up"
                style={{ animationDelay: `${Math.min(idx * 40, 200)}ms` }}
              >
                <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-accent text-muted-foreground group-hover:text-foreground group-hover:bg-primary/10 transition-all duration-200">
                  {getCategoryIcon(svc.categorySlug)}
                </div>
                <div className="flex-1 min-w-0 space-y-1 text-left">
                  <h3 className="font-semibold text-foreground line-clamp-2 leading-snug">{svc.displayName}</h3>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {svc.durationMinutes} min
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <DollarSign className="w-3.5 h-3.5" />
                      {svc.price.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-foreground icon-nudge shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── Step 2: Select Addons ──
  return (
    <div className="space-y-5 pb-32">
      <div className="flex items-center gap-3 fade-up-fast">
        <button
          onClick={() => { setStep('select-main'); setSelectedMain(null); setSelectedAddons([]); setComposition(null) }}
          className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors btn-press"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Adicionar complementos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Opcional — pule se não quiser adicionar nada</p>
        </div>
      </div>

      {/* Selected main */}
      {selectedMain && (
        <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 fade-up-fast">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              {getCategoryIcon(selectedMain.categorySlug)}
            </div>
            <div className="flex-1">
              <p className="text-xs text-primary font-medium">Serviço principal</p>
              <h3 className="font-semibold text-foreground">{selectedMain.displayName}</h3>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{selectedMain.durationMinutes} min</p>
              <p className="text-sm font-semibold text-foreground">R$ {selectedMain.price.toFixed(2).replace('.', ',')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Addons */}
      {loadingAddons ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : suggestedAddons.length === 0 ? (
        <div className="text-center py-8 space-y-3 fade-up-fast">
          <p className="text-sm text-muted-foreground">Nenhum complemento disponível para este serviço.</p>
        </div>
      ) : (
        <div className="space-y-4 fade-up-fast">
          {/* Strong addons (serviço secundário forte) */}
          {suggestedAddons.filter(a => a.tier === 'strong').length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-500" />
                Combina com seu atendimento
              </h3>
              {suggestedAddons.filter(a => a.tier === 'strong').map(addon => {
                const isSelected = selectedAddons.some(a => a.id === addon.id)
                return (
                  <button
                    key={addon.id}
                    onClick={() => toggleAddon(addon)}
                    className={`w-full p-4 rounded-2xl border text-left flex items-center gap-3 transition-all duration-200 btn-press
                      ${isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-card/50 hover:border-primary/20'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all
                      ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'}`}>
                      {isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground text-sm">{addon.displayName}</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{addon.durationMinutes}min</span>
                        <span className="flex items-center gap-1 font-medium"><DollarSign className="w-3 h-3" />{addon.price.toFixed(2).replace('.', ',')}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Light addons (addon leve) */}
          {suggestedAddons.filter(a => a.tier === 'light').length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Adicione se quiser
              </h3>
              {suggestedAddons.filter(a => a.tier === 'light').map(addon => {
                const isSelected = selectedAddons.some(a => a.id === addon.id)
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
                      <h4 className="font-medium text-foreground text-sm">{addon.displayName}</h4>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">{addon.durationMinutes}min</p>
                      <p className="text-xs font-medium text-foreground">+ R$ {addon.price.toFixed(2).replace('.', ',')}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Sticky bottom cart */}
      {selectedMain && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border p-4 safe-area-bottom fade-up-fast">
          <div className="max-w-lg mx-auto">
            {/* Summary */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Seu atendimento</p>
                <p className="text-sm font-semibold text-foreground line-clamp-1">
                  {loadingComposition ? '...' : (composition?.displayName || selectedMain.displayName)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                  <Clock className="w-3 h-3" />
                  {loadingComposition ? '...' : `${composition?.totalDurationMinutes || selectedMain.durationMinutes}min`}
                </p>
                <p className="text-base font-bold text-foreground">
                  R$ {loadingComposition ? '...' : (composition?.totalPrice || selectedMain.price).toFixed(2).replace('.', ',')}
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
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
