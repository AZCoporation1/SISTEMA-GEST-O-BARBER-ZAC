"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarCheck, Clock, DollarSign, ChevronRight, Users, Crown, Sparkles, Check } from 'lucide-react'
import { getPublicSubscriptionPlans } from '@/features/subscriptions/actions/subscription.actions'
import type { SubscriptionPlanWithProfessionals, VisitTemplateEntry } from '@/features/subscriptions/types'

interface SubscriptionPlanSelectorProps {
  onBack: () => void
}

export default function SubscriptionPlanSelector({ onBack }: SubscriptionPlanSelectorProps) {
  const router = useRouter()
  const [plans, setPlans] = useState<SubscriptionPlanWithProfessionals[]>([])
  const [loading, setLoading] = useState(true)
  const [activeScope, setActiveScope] = useState<string>('Todos')

  useEffect(() => {
    loadPlans()
  }, [])

  async function loadPlans() {
    setLoading(true)
    const result = await getPublicSubscriptionPlans()
    if (result.success && result.data) {
      setPlans(result.data)
    }
    setLoading(false)
  }

  const scopes = ['Todos', ...new Set(plans.map(p => {
    if (p.professional_scope === 'zac') return 'ZAC'
    if (p.professional_scope === 'gustavo_matheus') return 'Gustavo e Matheus'
    return 'Outros'
  }))]

  const filtered = plans.filter(p => {
    if (activeScope === 'Todos') return true
    if (activeScope === 'ZAC') return p.professional_scope === 'zac'
    if (activeScope === 'Gustavo e Matheus') return p.professional_scope === 'gustavo_matheus'
    return true
  })

  function getVisitSummary(plan: SubscriptionPlanWithProfessionals): string {
    const template = plan.visit_template_json as VisitTemplateEntry[]
    if (!template || template.length === 0) return `${plan.visits_per_cycle} visitas/mês`
    
    const items: Record<string, number> = {}
    for (const visit of template) {
      for (const item of visit.items) {
        items[item] = (items[item] || 0) + 1
      }
    }
    return Object.entries(items)
      .map(([item, qty]) => `${String(qty).padStart(2, '0')} ${item.charAt(0).toUpperCase() + item.slice(1)}${qty > 1 ? 's' : ''}`)
      .join(' + ')
  }

  function handleSelect(planId: string) {
    // Navigate to subscription flow with plan selected
    router.push(`/cliente/agendar?mode=subscription&planId=${planId}`)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        <p className="text-sm">Carregando planos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 fade-up-fast">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors btn-press">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Planos Mensais</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {plans.length} planos disponíveis · Desconto de 7% em serviços avulsos
          </p>
        </div>
      </div>

      {/* Benefit banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 fade-up-fast">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Crown className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Vantagens do Assinante</h3>
            <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-purple-500" /> Dia e horário fixos toda semana</li>
              <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-purple-500" /> 7% de desconto em serviços extras</li>
              <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-purple-500" /> Atendimento garantido sem fila</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Scope filter */}
      {scopes.length > 2 && (
        <div className="flex overflow-x-auto pb-2 -mx-4 px-4 snap-x hide-scrollbar gap-2">
          {scopes.map(scope => (
            <button
              key={scope}
              onClick={() => setActiveScope(scope)}
              className={`snap-center shrink-0 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border btn-press
                ${activeScope === scope
                  ? 'bg-purple-500 text-white border-transparent shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground'}`}
            >
              {scope}
            </button>
          ))}
        </div>
      )}

      {/* Plan cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground text-sm fade-up-fast">
            <CalendarCheck className="w-10 h-10 opacity-30" />
            <p>Nenhum plano disponível no momento.</p>
          </div>
        ) : (
          filtered.map((plan, idx) => (
            <button
              key={plan.id}
              onClick={() => handleSelect(plan.id)}
              className="w-full p-5 rounded-2xl border border-border bg-card/50 premium-card hover:border-purple-500/20 text-left group fade-up"
              style={{ animationDelay: `${Math.min(idx * 40, 200)}ms` }}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/20 text-purple-500 group-hover:scale-105 transition-transform">
                  <CalendarCheck className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground leading-snug">{plan.display_name}</h3>
                    <span className="shrink-0 text-lg font-bold text-purple-500">
                      R$ {plan.monthly_price.toFixed(2).replace('.', ',')}
                    </span>
                  </div>

                  {/* Items */}
                  <p className="text-xs text-muted-foreground">
                    {getVisitSummary(plan)}
                  </p>

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-0.5">
                    <span className="flex items-center gap-1">
                      <CalendarCheck className="w-3.5 h-3.5" />
                      {plan.visits_per_cycle} visitas/mês
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {plan.duration_minutes_per_visit}min por visita
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {plan.professionals.map(p => p.display_name || p.name).join(', ')}
                    </span>
                  </div>

                  {/* Badge */}
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-semibold">
                      <Sparkles className="w-2.5 h-2.5" />
                      Plano Mensal
                    </span>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-foreground shrink-0 mt-3 icon-nudge" />
              </div>
            </button>
          ))
        )}
      </div>

      {/* Checkout disclaimer */}
      <div className="text-center px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/10 fade-up">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Pagamento online em configuração. Após escolher seu plano, nossa equipe confirmará sua assinatura.
        </p>
      </div>
    </div>
  )
}
