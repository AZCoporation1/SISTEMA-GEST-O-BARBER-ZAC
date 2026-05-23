"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarCheck, Clock, DollarSign, ChevronRight, Users, Crown, Sparkles, Check, User, Phone, Loader2, AlertCircle, CheckCircle2, Calendar as CalendarIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getPublicSubscriptionPlans, checkSubscriptionAvailability, createSubscriptionDraft } from '@/features/subscriptions/actions/subscription.actions'
import { ensureCustomerForAuthUser } from '@/features/customers/actions/customer-auth.actions'
import type { SubscriptionPlanWithProfessionals, VisitTemplateEntry } from '@/features/subscriptions/types'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

interface SubscriptionFlowProps {
  planId: string
  onBack: () => void
}

type FlowStep = 'professional' | 'schedule' | 'confirm' | 'success'

const WEEKDAYS = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' }
]

const TIMES = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'
]

export default function SubscriptionFlow({ planId, onBack }: SubscriptionFlowProps) {
  const router = useRouter()
  const [step, setStep] = useState<FlowStep>('professional')
  const [plan, setPlan] = useState<SubscriptionPlanWithProfessionals | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedProfessional, setSelectedProfessional] = useState<{ id: string; name: string } | null>(null)
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null)
  const [selectedTime, setSelectedTime] = useState<string>('')
  
  // Availability check
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [availabilityResults, setAvailabilityResults] = useState<Array<{
    date: string
    startAt: string
    endAt: string
    available: boolean
    conflictReason?: string
  }> | null>(null)
  
  // Customer info
  const [customerId, setCustomerId] = useState<string>('')
  const [customerInfo, setCustomerInfo] = useState<{ name: string; phone: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadPlanAndAuth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId])

  async function loadPlanAndAuth() {
    setLoading(true)
    const supabase = createClient()
    
    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const currentPath = `/cliente/agendar?mode=subscription&planId=${planId}`
      router.push(`/cliente/login?callbackUrl=${encodeURIComponent(currentPath)}`)
      return
    }

    // Get customer info
    const ensureResult = await ensureCustomerForAuthUser(session.user.id, {
      email: session.user.email,
      fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
      phone: session.user.user_metadata?.phone,
    })

    if (ensureResult.success && ensureResult.customerId) {
      setCustomerId(ensureResult.customerId)
      setCustomerInfo({
        name: ensureResult.fullName || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Cliente',
        phone: ensureResult.phone || session.user.user_metadata?.phone || '',
      })
    } else {
      toast.error(ensureResult.error || "Não foi possível carregar os dados de cliente.")
      onBack()
      return
    }

    // Load plans and find the selected one
    const result = await getPublicSubscriptionPlans()
    if (result.success && result.data) {
      const matched = result.data.find(p => p.id === planId)
      if (matched) {
        setPlan(matched)
        // If there's only 1 professional, preselect it
        if (matched.professionals.length === 1) {
          setSelectedProfessional(matched.professionals[0])
        }
      } else {
        toast.error('Plano não encontrado.')
        onBack()
        return
      }
    } else {
      toast.error('Erro ao carregar o plano.')
      onBack()
      return
    }
    setLoading(false)
  }

  // Trigger availability check when professional, weekday, and time are selected
  useEffect(() => {
    if (selectedProfessional && selectedWeekday !== null && selectedTime && plan) {
      checkAvailability()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfessional, selectedWeekday, selectedTime])

  async function checkAvailability() {
    if (!selectedProfessional || selectedWeekday === null || !selectedTime || !plan) return
    setCheckingAvailability(true)
    setAvailabilityResults(null)

    const res = await checkSubscriptionAvailability({
      professionalId: selectedProfessional.id,
      weekday: selectedWeekday,
      time: selectedTime,
      durationMinutes: plan.duration_minutes_per_visit,
      visitsCount: plan.visits_per_cycle,
    })

    if (res.success && res.data) {
      setAvailabilityResults(res.data)
    } else {
      toast.error(res.error || 'Erro ao verificar disponibilidade.')
    }
    setCheckingAvailability(false)
  }

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

  async function handleConfirmSubscription() {
    if (!plan || !selectedProfessional || selectedWeekday === null || !selectedTime || !customerId) {
      toast.error('Preencha todas as informações.')
      return
    }

    setIsSubmitting(true)
    const res = await createSubscriptionDraft({
      customerId,
      planId: plan.id,
      professionalId: selectedProfessional.id,
      fixedWeekday: selectedWeekday,
      fixedTime: selectedTime,
    })

    if (res.success) {
      setStep('success')
      toast.success('Assinatura solicitada com sucesso!')
    } else {
      toast.error(res.error || 'Erro ao solicitar assinatura.')
    }
    setIsSubmitting(false)
  }

  if (loading || !plan) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
        <p className="text-sm">Carregando dados da assinatura...</p>
      </div>
    )
  }

  // ── Success State ──
  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[50vh] px-4 gap-6 fade-up">
        <div className="success-entrance">
          <div className="w-20 h-20 rounded-full bg-purple-500/10 border-2 border-purple-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-purple-500" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-foreground">Assinatura Solicitada!</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Sua solicitação do plano <b>{plan.display_name}</b> com {selectedProfessional?.name} foi criada.
          </p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Nossa equipe entrará em contato para ativar sua assinatura e confirmar as datas.
          </p>
        </div>
        <button
          onClick={() => router.push('/cliente/meus-agendamentos')}
          className="inline-flex px-5 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors btn-press"
        >
          Ir para meus agendamentos
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 fade-up-fast">
        <button
          onClick={() => {
            if (step === 'professional') onBack()
            else if (step === 'schedule') setStep('professional')
            else if (step === 'confirm') setStep('schedule')
          }}
          className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors btn-press"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Adesão de Plano</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {plan.display_name} · R$ {plan.monthly_price.toFixed(2).replace('.', ',')}/mês
          </p>
        </div>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1 border-b border-border/50 pb-2">
        <span className={step === 'professional' ? 'text-purple-500 font-bold' : ''}>1. Profissional</span>
        <span className={step === 'schedule' ? 'text-purple-500 font-bold' : ''}>2. Dia e Horário</span>
        <span className={step === 'confirm' ? 'text-purple-500 font-bold' : ''}>3. Confirmação</span>
      </div>

      {/* Plan Preview Banner */}
      <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-1">
        <div className="flex justify-between items-start">
          <span className="text-xs text-purple-500 font-semibold uppercase tracking-wider">Você escolheu</span>
          <span className="text-sm font-bold text-foreground">R$ {plan.monthly_price.toFixed(2).replace('.', ',')}</span>
        </div>
        <h3 className="font-bold text-foreground text-sm">{plan.display_name}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{getVisitSummary(plan)}</p>
      </div>

      {/* Step 1: Select Professional */}
      {step === 'professional' && (
        <div className="space-y-4 fade-up">
          <h3 className="text-sm font-semibold text-foreground">Quem você gostaria que te atendesse?</h3>
          <div className="grid grid-cols-1 gap-2">
            {plan.professionals.map(prof => (
              <button
                key={prof.id}
                onClick={() => setSelectedProfessional(prof)}
                className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all duration-200 btn-press
                  ${selectedProfessional?.id === prof.id
                    ? 'border-purple-500 bg-purple-500/5 shadow-sm'
                    : 'border-border bg-card/50 hover:border-purple-500/20'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all
                    ${selectedProfessional?.id === prof.id ? 'bg-purple-500 text-white' : 'bg-accent text-muted-foreground'}`}>
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">{prof.display_name || prof.name}</h4>
                    <p className="text-xs text-muted-foreground">Profissional do plano</p>
                  </div>
                </div>
                {selectedProfessional?.id === prof.id && (
                  <Check className="w-5 h-5 text-purple-500" />
                )}
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep('schedule')}
            disabled={!selectedProfessional}
            className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-purple-500 text-white font-semibold premium-cta hover:bg-purple-600 disabled:opacity-50 transition-all"
          >
            Continuar para agenda <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 2: Choose Weekday & Time */}
      {step === 'schedule' && (
        <div className="space-y-6 fade-up">
          {/* Weekday Selection */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Escolha o dia fixo da semana</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WEEKDAYS.map(day => (
                <button
                  key={day.value}
                  onClick={() => {
                    setSelectedWeekday(day.value)
                    setAvailabilityResults(null)
                  }}
                  className={`p-3 rounded-xl border text-center text-sm font-medium transition-all btn-press
                    ${selectedWeekday === day.value
                      ? 'bg-purple-500 text-white border-transparent shadow-sm'
                      : 'bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground'}`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Escolha o horário fixo</h3>
            <div className="grid grid-cols-4 gap-2 max-h-[220px] overflow-y-auto pr-1">
              {TIMES.map(time => (
                <button
                  key={time}
                  onClick={() => {
                    setSelectedTime(time)
                    setAvailabilityResults(null)
                  }}
                  className={`p-2 rounded-xl border text-center text-xs font-semibold transition-all btn-press
                    ${selectedTime === time
                      ? 'bg-purple-500 text-white border-transparent shadow-sm'
                      : 'bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground'}`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>

          {/* Availability Preview */}
          {checkingAvailability && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
              <span>Verificando disponibilidade da agenda...</span>
            </div>
          )}

          {availabilityResults && (
            <div className="space-y-3 p-4 rounded-xl border border-border/80 bg-card">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-purple-500" />
                Previsão das próximas {plan.visits_per_cycle} visitas
              </h4>
              <div className="space-y-2">
                {availabilityResults.map((occ, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs border-b border-border/40 pb-1.5 last:border-b-0 last:pb-0">
                    <span className="capitalize text-muted-foreground">
                      {format(parseISO(occ.date), "EEEE, dd/MM", { locale: ptBR })} às {selectedTime}
                    </span>
                    {occ.available ? (
                      <span className="text-green-500 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Disponível
                      </span>
                    ) : (
                      <span className="text-red-500 font-semibold flex items-center gap-1" title={occ.conflictReason}>
                        <AlertCircle className="w-3 h-3" /> Indisponível
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {availabilityResults.some(r => !r.available) && (
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-[11px] text-red-500 leading-relaxed mt-2 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    O profissional escolhido possui um conflito em alguma data acima. Por favor, escolha outro dia ou horário.
                  </span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setStep('confirm')}
            disabled={!selectedProfessional || selectedWeekday === null || !selectedTime || checkingAvailability || (availabilityResults ? availabilityResults.some(r => !r.available) : false)}
            className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-purple-500 text-white font-semibold premium-cta hover:bg-purple-600 disabled:opacity-50 transition-all"
          >
            Continuar para confirmação <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 3: Confirm Details */}
      {step === 'confirm' && (
        <div className="space-y-6 fade-up">
          <div className="p-6 rounded-2xl border border-border bg-card/50 space-y-6 shadow-sm">
            {/* Plan Info */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Plano escolhido</h3>
              <p className="text-base font-bold text-foreground">{plan.display_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{getVisitSummary(plan)}</p>
            </div>

            {/* Professional */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Profissional</h3>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-purple-500" />
                <p className="text-sm font-semibold text-foreground">{selectedProfessional?.name}</p>
              </div>
            </div>

            {/* Recurrence Rule */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Regra de Recorrência</h3>
              <div className="flex items-center gap-4 text-sm text-foreground">
                <span className="capitalize font-semibold text-purple-500">
                  Todo(a) {WEEKDAYS.find(d => d.value === selectedWeekday)?.label.split('-')[0]}
                </span>
                <span className="font-semibold text-purple-500">
                  às {selectedTime}
                </span>
              </div>
            </div>

            {/* Customer Details */}
            {customerInfo && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Dados do Assinante</h3>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{customerInfo.name}</span>
                  </div>
                  {customerInfo.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{customerInfo.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Preview Dates List */}
            {availabilityResults && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Primeiro Ciclo (Agenda)</h3>
                <div className="space-y-1.5 pl-3 border-l-2 border-purple-500/20">
                  {availabilityResults.map((occ, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs text-muted-foreground">
                      <span className="capitalize">
                        {format(parseISO(occ.date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </span>
                      <span>às {selectedTime}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Payment Disclaimer */}
          <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
            <Crown className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
            <span>
              Ao aderir ao plano, seus horários serão reservados na agenda. A ativação final ocorrerá após nossa equipe confirmar o método de pagamento.
            </span>
          </div>

          <button
            onClick={handleConfirmSubscription}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-purple-500 text-white font-semibold premium-cta hover:bg-purple-600 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5" />
                Confirmar e Solicitar Assinatura
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
