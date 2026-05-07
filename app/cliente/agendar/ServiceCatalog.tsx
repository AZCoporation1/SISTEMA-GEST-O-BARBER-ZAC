"use client"

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, DollarSign, Scissors, Sparkles, Wand2, Hand, Droplets, Eye, Paintbrush, PenTool, X, ChevronRight, Search } from 'lucide-react'
import type { PublicCatalogService } from '@/features/agenda/actions/public-booking.actions'

// ── Icon resolver ──────────────────────────────────────────
function resolveServiceIcon(serviceName: string, categoryName: string) {
  const name = (serviceName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const cat = (categoryName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const combined = `${name} ${cat}`

  if (/corte|cabelo|social|degrade|fade|tesoura|barba|cavanhaque|bigode|barboterapia|razor|aparar/.test(combined)) {
    return <Scissors className="w-5 h-5" />
  }
  if (/sobrancelha/.test(combined)) {
    return <Eye className="w-5 h-5" />
  }
  if (/limpeza|pele|skin|estetica|facial/.test(combined)) {
    return <Sparkles className="w-5 h-5" />
  }
  if (/hidratacao|tratamento|reconstrucao|cauterizacao/.test(combined)) {
    return <Droplets className="w-5 h-5" />
  }
  if (/luzes|reflexo|nevou|platinado|coloracao|tintura|mechas/.test(combined)) {
    return <Paintbrush className="w-5 h-5" />
  }
  if (/alisamento|progressiva|botox|selagem|quimica/.test(combined)) {
    return <Wand2 className="w-5 h-5" />
  }
  if (/massoterapia|massagem|relaxamento/.test(combined)) {
    return <Hand className="w-5 h-5" />
  }
  if (/depilacao|cera|nasal|orelha/.test(combined)) {
    return <Sparkles className="w-5 h-5" />
  }
  if (/pigmentacao|micropigmentacao/.test(combined)) {
    return <PenTool className="w-5 h-5" />
  }
  return <Scissors className="w-5 h-5" />
}

interface ServiceCatalogProps {
  services: PublicCatalogService[]
}

export default function ServiceCatalog({ services }: ServiceCatalogProps) {
  const router = useRouter()
  const [activeCategory, setActiveCategory] = useState("Todos")
  const [search, setSearch] = useState("")
  const [selectedService, setSelectedService] = useState<PublicCatalogService | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const uniqueCategories = Array.from(new Set(services.map(s => s.categoryName)))
  const displayCategories = ["Todos", ...uniqueCategories.filter(c => c !== "Todos")]

  // Filter services
  const filtered = services.filter(s => {
    const matchCategory = activeCategory === "Todos" || s.categoryName === activeCategory
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase())
    return matchCategory && matchSearch
  })

  // Close sheet on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setSelectedService(null)
      }
    }
    if (selectedService) {
      document.addEventListener('mousedown', handleClickOutside)
      // Prevent background scroll
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = ''
    }
  }, [selectedService])

  // Close on Escape
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedService(null)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [])

  const handleBookService = (serviceId: string) => {
    setSelectedService(null)
    router.push(`/cliente/agendar/profissional?serviceId=${serviceId}`)
  }

  return (
    <>
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
        {displayCategories.map((cat) => (
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
          filtered.map((service, idx) => (
            <div
              key={service.id}
              className="p-4 rounded-2xl border border-border bg-card/50 premium-card hover:border-primary/20 flex items-center gap-4 group fade-up"
              style={{ animationDelay: `${Math.min(idx * 40, 200)}ms` }}
            >
              {/* Icon */}
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-accent text-muted-foreground group-hover:text-foreground group-hover:bg-primary/10 transition-all duration-200">
                {resolveServiceIcon(service.name, service.categoryName)}
              </div>

              {/* Content — clickable for details */}
              <button
                onClick={() => setSelectedService(service)}
                className="flex-1 min-w-0 space-y-1 text-left"
              >
                <h3 className="font-semibold text-foreground line-clamp-2 leading-snug">{service.name}</h3>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {service.durationMinutes} min
                  </span>
                  <span className="flex items-center gap-1 font-medium text-muted-foreground">
                    <DollarSign className="w-3.5 h-3.5" />
                    {service.price.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </button>

              {/* Book button */}
              <button
                onClick={() => handleBookService(service.id)}
                className="flex-shrink-0 px-4 py-2 rounded-xl bg-primary/10 text-foreground text-sm font-medium btn-press hover:bg-primary/20 hover:shadow-sm transition-all duration-150 flex items-center gap-1"
              >
                Agendar
                <ChevronRight className="w-4 h-4 icon-nudge" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Detail sheet/modal overlay */}
      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
          
          {/* Sheet */}
          <div
            ref={sheetRef}
            className="relative w-full sm:max-w-md max-h-[85vh] bg-background border border-border rounded-t-3xl sm:rounded-2xl overflow-y-auto animate-in slide-in-from-bottom-4 duration-300 z-10"
          >
            {/* Drag indicator (mobile) */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="w-12 h-1.5 rounded-full bg-border" />
            </div>

            {/* Close button */}
            <button
              onClick={() => setSelectedService(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground hover:rotate-90 transition-all duration-200 z-20"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 space-y-6">
              {/* Icon + Category */}
              <div className="flex items-center gap-3 fade-up-fast">
                <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                  {resolveServiceIcon(selectedService.name, selectedService.categoryName)}
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {selectedService.categoryName}
                  </span>
                </div>
              </div>

              {/* Full name */}
              <h2 className="text-xl font-bold text-foreground leading-tight">
                {selectedService.name}
              </h2>

              {/* Description */}
              <div className="text-sm text-muted-foreground leading-relaxed">
                {selectedService.description
                  ? selectedService.description
                  : "Serviço profissional do Instituto Barber Zac. Consulte detalhes no atendimento."}
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-card border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Duração</p>
                  <p className="text-lg font-bold text-foreground flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    {selectedService.durationMinutes} min
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Preço</p>
                  <p className="text-lg font-bold text-foreground flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    {selectedService.price.toFixed(2).replace('.', ',')}
                  </p>
                </div>
              </div>

              {/* Book CTA */}
              <button
                onClick={() => handleBookService(selectedService.id)}
                className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-primary text-primary-foreground font-semibold premium-cta hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Scissors className="w-5 h-5" />
                Agendar este serviço
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
