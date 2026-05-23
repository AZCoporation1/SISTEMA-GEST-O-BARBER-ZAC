"use client"

import { useRouter } from 'next/navigation'
import { Package, Wrench, List, Sparkles, Star, Clock, DollarSign, ChevronRight, CalendarCheck } from 'lucide-react'
import type { PublicCatalogServiceV2 } from '@/features/agenda/actions/public-booking.actions'

// ── Popular Services (real IDs resolved at render time) ──
const POPULAR_KEYWORDS = [
  'combo 1 ( degrade + sobrancelha )',
  'combo 1 (degrade+sobrancelha) zac',
  'corte (degrade)',
  'combo 2 (corte + barba',
  'corte zac',
  'corte s. executivo',
  'barba&terapia',
]

function normalizeForCompare(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}

function resolvePopularServices(services: PublicCatalogServiceV2[]): PublicCatalogServiceV2[] {
  const popular: PublicCatalogServiceV2[] = []
  for (const kw of POPULAR_KEYWORDS) {
    const match = services.find(s => normalizeForCompare(s.name).startsWith(kw))
    if (match && !popular.find(p => p.id === match.id)) {
      popular.push(match)
    }
    if (popular.length >= 5) break
  }
  return popular
}

interface BookingModeSelectorProps {
  services: PublicCatalogServiceV2[]
}

export default function BookingModeSelector({ services }: BookingModeSelectorProps) {
  const router = useRouter()
  const popularServices = resolvePopularServices(services)
  const comboCount = services.filter(s => s.isCombo && !s.isPlan).length
  const mainCount = services.filter(s => !s.isCombo && !s.isPlan && s.canBeMain).length
  const subscriptionsEnabled = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED !== 'false'

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="text-center space-y-2 fade-up-fast">
        <h2 className="text-2xl font-bold text-foreground">Como você quer agendar?</h2>
        <p className="text-sm text-muted-foreground">
          Escolha um combo pronto ou monte seu atendimento do seu jeito.
        </p>
      </div>

      {/* Two main cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Combo Pronto */}
        <button
          onClick={() => router.push('/cliente/agendar?mode=combo')}
          className="group relative p-6 rounded-2xl border border-border bg-card/50 premium-card hover:border-primary/30 text-left transition-all duration-300 fade-up"
          style={{ animationDelay: '100ms' }}
        >
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
            {comboCount} opções
          </div>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
            <Package className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">Combo Pronto</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Escolha uma opção já montada com os serviços mais pedidos.
          </p>
          <div className="mt-4 flex items-center gap-1 text-xs text-primary font-medium group-hover:gap-2 transition-all">
            Ver combos <ChevronRight className="w-3.5 h-3.5 icon-nudge" />
          </div>
        </button>

        {/* Montar Atendimento */}
        <button
          onClick={() => router.push('/cliente/agendar?mode=build')}
          className="group relative p-6 rounded-2xl border border-border bg-card/50 premium-card hover:border-primary/30 text-left transition-all duration-300 fade-up"
          style={{ animationDelay: '200ms' }}
        >
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
            {mainCount} serviços
          </div>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
            <Wrench className="w-7 h-7 text-amber-500" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">Montar Atendimento</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Escolha um serviço principal e adicione complementos.
          </p>
          <div className="mt-4 flex items-center gap-1 text-xs text-amber-500 font-medium group-hover:gap-2 transition-all">
            Montar agora <ChevronRight className="w-3.5 h-3.5 icon-nudge" />
          </div>
        </button>
      </div>

      {/* Subscription card */}
      {subscriptionsEnabled && (
        <div className="fade-up" style={{ animationDelay: '250ms' }}>
          <button
            onClick={() => router.push('/cliente/agendar?mode=subscription')}
            className="group relative w-full p-6 rounded-2xl border border-border bg-card/50 premium-card hover:border-purple-500/30 text-left transition-all duration-300"
          >
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-semibold">
              Planos mensais
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
              <CalendarCheck className="w-7 h-7 text-purple-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Assinaturas Mensais</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Escolha um plano mensal com dia e horário fixo. Desconto exclusivo para assinantes.
            </p>
            <div className="mt-4 flex items-center gap-1 text-xs text-purple-500 font-medium group-hover:gap-2 transition-all">
              Ver planos <ChevronRight className="w-3.5 h-3.5 icon-nudge" />
            </div>
          </button>
        </div>
      )}

      {/* Popular Services */}
      {popularServices.length > 0 && (
        <div className="space-y-3 fade-up" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">Mais pedidos</h3>
          </div>
          <div className="flex overflow-x-auto pb-2 -mx-4 px-4 snap-x hide-scrollbar gap-3">
            {popularServices.map(svc => (
              <button
                key={svc.id}
                onClick={() => router.push(`/cliente/agendar/profissional?serviceId=${svc.id}`)}
                className="snap-center shrink-0 w-52 p-4 rounded-2xl border border-border bg-card/50 premium-card hover:border-primary/20 text-left group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide line-clamp-1">
                    {svc.displayCategories[0] || svc.categoryName}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug mb-2">
                  {svc.displayName}
                </h4>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {svc.durationMinutes}min
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <DollarSign className="w-3 h-3" />
                    {svc.price.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fallback link */}
      <div className="text-center fade-up" style={{ animationDelay: '400ms' }}>
        <button
          onClick={() => router.push('/cliente/agendar?mode=all')}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors btn-press"
        >
          <List className="w-3.5 h-3.5" />
          Ver todos os serviços
        </button>
      </div>
    </div>
  )
}
