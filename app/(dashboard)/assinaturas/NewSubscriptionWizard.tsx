"use client"

/**
 * Barber Zac ERP — New Internal Subscription Wizard
 * Multi-step modal wizard for admin to create subscriptions internally.
 * Steps: 1. Customer → 2. Plan → 3. Professional → 4. Schedule → 5. Availability → 6. Payment → 7. Confirm
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  X, Search, UserPlus, ChevronRight, ChevronLeft,
  Calendar, Clock, DollarSign, CheckCircle, XCircle,
  AlertTriangle, Loader2, MapPin, CreditCard, Sparkles, User
} from 'lucide-react'
import {
  getAdminSubscriptionPlans,
  getPlanAllowedProfessionals,
  checkSubscriptionAvailability,
  createInternalSubscription,
  searchCustomersForSubscription,
  createQuickCustomer,
} from '@/features/subscriptions/actions/subscription.actions'
import { WEEKDAY_NAMES, type SubscriptionPlanWithProfessionals } from '@/features/subscriptions/types'

interface NewSubscriptionWizardProps {
  onClose: () => void
  onCreated: () => void
}

type Step = 'customer' | 'plan' | 'professional' | 'schedule' | 'availability' | 'payment' | 'confirm'

const STEPS: Step[] = ['customer', 'plan', 'professional', 'schedule', 'availability', 'payment', 'confirm']
const STEP_LABELS: Record<Step, string> = {
  customer: 'Cliente',
  plan: 'Plano',
  professional: 'Profissional',
  schedule: 'Recorrência',
  availability: 'Disponibilidade',
  payment: 'Pagamento',
  confirm: 'Confirmação',
}

export default function NewSubscriptionWizard({ onClose, onCreated }: NewSubscriptionWizardProps) {
  const [step, setStep] = useState<Step>('customer')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  // Step 1: Customer
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const searchTimeout = useRef<any>(null)

  // Step 2: Plan
  const [plans, setPlans] = useState<SubscriptionPlanWithProfessionals[]>([])
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanWithProfessionals | null>(null)

  // Customization
  const [isCustomized, setIsCustomized] = useState(false)
  const [customPlanName, setCustomPlanName] = useState('')
  const [monthlyPriceSnapshot, setMonthlyPriceSnapshot] = useState<number | ''>('')
  const [visitsPerCycleSnapshot, setVisitsPerCycleSnapshot] = useState<number | ''>('')
  const [durationMinutesSnapshot, setDurationMinutesSnapshot] = useState<number | ''>('')
  const [customServicesSnapshotText, setCustomServicesSnapshotText] = useState('')

  // Step 3: Professional
  const [professionals, setProfessionals] = useState<any[]>([])
  const [selectedProfessional, setSelectedProfessional] = useState<any>(null)

  // Step 4: Schedule
  const [fixedWeekday, setFixedWeekday] = useState(1) // Monday default
  const [fixedTime, setFixedTime] = useState('10:00')
  const [billingDay, setBillingDay] = useState(5)
  const [initialStatus, setInitialStatus] = useState<'active' | 'pending_payment' | 'draft'>('active')
  const [notes, setNotes] = useState('')

  // Step 5: Availability
  const [availResults, setAvailResults] = useState<any[]>([])
  const [availChecked, setAvailChecked] = useState(false)

  // Step 6: Payment
  const [paymentMethod, setPaymentMethod] = useState('pix')
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending' | 'waived'>('paid')

  // Step 7: Confirm
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [confirmDuplicate, setConfirmDuplicate] = useState(false)

  const stepIndex = STEPS.indexOf(step)

  // ── Customer Search ──
  const doSearch = useCallback(async (term: string) => {
    if (term.length < 2) { setSearchResults([]); return }
    const result = await searchCustomersForSubscription(term)
    if (result.success && result.data) setSearchResults(result.data)
  }, [])

  useEffect(() => {
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => doSearch(searchTerm), 350)
    return () => clearTimeout(searchTimeout.current)
  }, [searchTerm, doSearch])

  // ── Load Plans ──
  async function loadPlans() {
    setLoading(true)
    const result = await getAdminSubscriptionPlans()
    if (result.success && result.data) setPlans(result.data)
    setLoading(false)
  }

  // ── Load All Active Professionals ──
  async function loadProfessionals() {
    setLoading(true)
    if (selectedPlan) {
      const result = await getPlanAllowedProfessionals(selectedPlan.id)
      if (result.success && result.data) {
        setProfessionals(result.data)
      }
    }
    setLoading(false)
  }

  // ── Check Availability ──
  async function checkAvailability() {
    if (!selectedPlan || !selectedProfessional) return
    setLoading(true)
    setAvailChecked(false)
    const durationMins = isCustomized ? Number(durationMinutesSnapshot) : selectedPlan.duration_minutes_per_visit
    const vCount = isCustomized ? Number(visitsPerCycleSnapshot) : selectedPlan.visits_per_cycle

    const result = await checkSubscriptionAvailability({
      professionalId: selectedProfessional.id,
      weekday: fixedWeekday,
      time: fixedTime,
      durationMinutes: durationMins,
      visitsCount: vCount,
    })
    if (result.success && result.data) {
      setAvailResults(result.data)
      setAvailChecked(true)
    }
    setLoading(false)
  }

  // ── Create Quick Customer ──
  async function handleCreateCustomer() {
    if (!newName.trim() || !newPhone.trim()) { alert('Nome e telefone são obrigatórios.'); return }
    setLoading(true)
    const result = await createQuickCustomer({ fullName: newName, phone: newPhone, email: newEmail || undefined })
    if (result.success && result.customerId) {
      setSelectedCustomer({ id: result.customerId, full_name: newName, phone: newPhone, email: newEmail || null })
      setShowNewCustomer(false)
      setNewName(''); setNewPhone(''); setNewEmail('')
    } else {
      alert(result.error || 'Erro ao criar cliente.')
    }
    setLoading(false)
  }

  // ── Submit ──
  async function handleSubmit() {
    if (!selectedCustomer || !selectedPlan || !selectedProfessional) return
    setCreating(true)
    const result = await createInternalSubscription({
      customerId: selectedCustomer.id,
      planId: selectedPlan.id,
      professionalId: selectedProfessional.id,
      fixedWeekday,
      fixedTime,
      billingDay,
      status: initialStatus,
      paymentMethod,
      paymentStatus: initialStatus === 'active' ? paymentStatus : undefined,
      notes: notes || undefined,
      confirmDuplicate,
      isCustomized,
      customPlanName: isCustomized ? customPlanName : undefined,
      customServicesSnapshot: isCustomized ? customServicesSnapshotText.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      monthlyPriceSnapshot: isCustomized ? Number(monthlyPriceSnapshot) : undefined,
      visitsPerCycleSnapshot: isCustomized ? Number(visitsPerCycleSnapshot) : undefined,
      durationMinutesSnapshot: isCustomized ? Number(durationMinutesSnapshot) : undefined,
    })

    if (result.success) {
      onCreated()
      onClose()
    } else if (result.error === 'DUPLICATE_WARNING') {
      setDuplicateWarning(result.warning || 'Assinatura duplicada.')
      setCreating(false)
    } else {
      alert(result.error || 'Erro ao criar assinatura.')
      setCreating(false)
    }
  }

  // ── Step Navigation ──
  function goNext() {
    if (idx < STEPS.length - 1) {
      const next = STEPS[idx + 1]
      if (next === 'plan') loadPlans()
      if (next === 'professional') loadProfessionals()
      if (next === 'availability') { setAvailResults([]); setAvailChecked(false) }
      setStep(next)
    }
  }
  const idx = STEPS.indexOf(step)
  function goBack() {
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  const canGoNext = () => {
    switch (step) {
      case 'customer': return !!selectedCustomer
      case 'plan': return !!selectedPlan
      case 'professional': return !!selectedProfessional
      case 'schedule': return fixedWeekday >= 0 && fixedTime && billingDay >= 1 && billingDay <= 31
      case 'availability': return availChecked && availResults.every(r => r.available)
      case 'payment': return true
      case 'confirm': return true
      default: return false
    }
  }

  const hasConflicts = availChecked && availResults.some(r => !r.available)

  const inputClass = "w-full px-4 py-3 bg-card border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all"
  
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] md:max-h-[85vh] flex flex-col bg-card border border-border rounded-3xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 p-5 md:p-6 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground leading-tight">Nova Assinatura</h2>
                <div className="text-xs font-semibold text-purple-500 mt-0.5">
                  Etapa {stepIndex + 1} de {STEPS.length} — {STEP_LABELS[step]}
                </div>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 rounded-xl bg-accent/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-5 w-full h-1.5 bg-border rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 md:p-8">
          {/* ── STEP: Customer ── */}
          {step === 'customer' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <h3 className="text-sm font-bold text-foreground mb-4">Selecione o Cliente</h3>
              
              {selectedCustomer ? (
                <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-purple-500 bg-purple-500/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-600 flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-foreground">{selectedCustomer.full_name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {selectedCustomer.phone} {selectedCustomer.email ? `• ${selectedCustomer.email}` : ''}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedCustomer(null)} 
                    className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-purple-500 transition-colors" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Buscar por nome ou telefone..."
                      className={`${inputClass} pl-11`}
                      autoFocus
                    />
                  </div>

                  {searchResults.length > 0 && (
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {searchResults.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedCustomer(c); setSearchTerm(''); setSearchResults([]) }}
                          className="w-full p-4 rounded-xl border border-border bg-card hover:border-purple-500/40 hover:bg-purple-500/5 text-left transition-all group flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-accent group-hover:bg-purple-500/20 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-muted-foreground group-hover:text-purple-600" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-foreground">{c.full_name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{c.phone || 'Sem telefone'}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {!showNewCustomer ? (
                    <div className="pt-2">
                      <button
                        onClick={() => setShowNewCustomer(true)}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-border hover:border-purple-500/50 text-purple-500 font-bold text-sm bg-transparent hover:bg-purple-500/5 transition-all"
                      >
                        <UserPlus className="w-4 h-4" /> Cadastrar Novo Cliente
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl border border-border bg-accent/20 space-y-4">
                      <div className="text-sm font-bold text-foreground flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-purple-500" /> Cadastro Rápido
                      </div>
                      <div className="space-y-3">
                        <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome completo *" className={inputClass} />
                        <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Telefone *" className={inputClass} />
                        <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email (opcional)" className={inputClass} />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button onClick={() => setShowNewCustomer(false)} className="flex-1 btn btn-secondary">Cancelar</button>
                        <button 
                          onClick={handleCreateCustomer} 
                          disabled={loading} 
                          className="flex-1 btn bg-purple-500 hover:bg-purple-600 text-white border-none"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Cliente'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── STEP: Plan ── */}
          {step === 'plan' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <h3 className="text-sm font-bold text-foreground mb-4">Escolha o Plano Mensal</h3>
              
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mb-4 text-purple-500" />
                  <span className="text-sm font-medium">Carregando planos...</span>
                </div>
              ) : plans.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
                  Nenhum plano ativo encontrado.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {plans.map(plan => (
                    <button
                      key={plan.id}
                      onClick={() => {
                        setSelectedPlan(plan)
                        setIsCustomized(false)
                        setCustomPlanName(plan.display_name)
                        setMonthlyPriceSnapshot(plan.monthly_price)
                        setVisitsPerCycleSnapshot(plan.visits_per_cycle)
                        setDurationMinutesSnapshot(plan.duration_minutes_per_visit)
                        setCustomServicesSnapshotText(plan.visit_template_json?.[0]?.items?.join(', ') || '')
                      }}
                      className={`flex justify-between items-center p-5 rounded-2xl border-2 text-left transition-all ${
                        selectedPlan?.id === plan.id 
                          ? 'border-purple-500 bg-purple-500/5 shadow-md shadow-purple-500/10' 
                          : 'border-border bg-card hover:border-purple-500/30 hover:bg-accent/50'
                      }`}
                    >
                      <div>
                        <div className="text-base font-bold text-foreground">{plan.display_name}</div>
                        <div className="text-xs text-muted-foreground mt-1 font-medium">
                          {plan.visits_per_cycle} visitas • {plan.duration_minutes_per_visit} min cada
                        </div>
                        {plan.professionals.length > 0 && (
                          <div className="text-[10px] text-muted-foreground/80 mt-2 line-clamp-1">
                            <span className="font-semibold text-muted-foreground">Pros:</span> {plan.professionals.map(p => p.display_name || p.name).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="text-lg font-black text-purple-500">
                        R$ {plan.monthly_price.toFixed(2).replace('.', ',')}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedPlan && (
                <div className="mt-6 pt-6 border-t border-border">
                  <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={isCustomized}
                      onChange={e => setIsCustomized(e.target.checked)}
                      className="w-5 h-5 rounded border-purple-500/50 text-purple-500 focus:ring-purple-500 bg-transparent"
                    />
                    <div className="text-sm font-bold text-foreground">
                      Deseja personalizar este plano para este cliente?
                    </div>
                  </label>
                  
                  {isCustomized && (
                    <div className="mt-4 p-5 rounded-2xl bg-accent/20 border border-border space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-3.5 h-3.5" /> Personalização de Combo
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground">Nome Customizado</label>
                          <input type="text" value={customPlanName} onChange={e => setCustomPlanName(e.target.value)} className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground">Valor Mensal (R$)</label>
                          <input type="number" step="0.01" value={monthlyPriceSnapshot} onChange={e => setMonthlyPriceSnapshot(Number(e.target.value))} className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground">Visitas por Ciclo</label>
                          <input type="number" value={visitsPerCycleSnapshot} onChange={e => setVisitsPerCycleSnapshot(Number(e.target.value))} className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground">Duração da Visita (min)</label>
                          <input type="number" value={durationMinutesSnapshot} onChange={e => setDurationMinutesSnapshot(Number(e.target.value))} className={inputClass} />
                        </div>
                        <div className="col-span-1 sm:col-span-2 space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground">Serviços por Visita (separados por vírgula)</label>
                          <input type="text" value={customServicesSnapshotText} onChange={e => setCustomServicesSnapshotText(e.target.value)} className={inputClass} placeholder="Ex: Cabelo, Barba" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP: Professional ── */}
          {step === 'professional' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <h3 className="text-sm font-bold text-foreground mb-2">Profissional Atendente</h3>
              
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 text-xs font-medium leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                Administradores podem atribuir qualquer profissional ativo, independente das regras originais do plano.
              </div>
              
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mb-4 text-purple-500" />
                  <span className="text-sm font-medium">Carregando profissionais...</span>
                </div>
              ) : professionals.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
                  Nenhum profissional disponível.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  {professionals.map(prof => (
                    <button
                      key={prof.id}
                      onClick={() => setSelectedProfessional(prof)}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                        selectedProfessional?.id === prof.id 
                          ? 'border-purple-500 bg-purple-500/5 shadow-md shadow-purple-500/10' 
                          : 'border-border bg-card hover:border-purple-500/30 hover:bg-accent/50'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black transition-colors ${
                        selectedProfessional?.id === prof.id ? 'bg-purple-500 text-white' : 'bg-accent text-accent-foreground'
                      }`}>
                        {(prof.display_name || prof.name)?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="text-sm font-bold text-foreground">
                        {prof.display_name || prof.name}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STEP: Schedule ── */}
          {step === 'schedule' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <h3 className="text-sm font-bold text-foreground mb-2">Definir Recorrência</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Weekday */}
                <div className="space-y-2.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Dia da Semana
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6].map(d => (
                      <button
                        key={d}
                        onClick={() => setFixedWeekday(d)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border-2 ${
                          fixedWeekday === d 
                            ? 'bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-400' 
                            : 'bg-card border-border text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        {WEEKDAY_NAMES[d].split('-')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time */}
                <div className="space-y-2.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Horário Fixo
                  </label>
                  <input 
                    type="time" 
                    value={fixedTime} 
                    onChange={e => setFixedTime(e.target.value)} 
                    className={inputClass} 
                  />
                </div>

                {/* Billing Day */}
                <div className="space-y-2.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" /> Dia de Pagamento
                  </label>
                  <input 
                    type="number" min={1} max={31} 
                    value={billingDay} 
                    onChange={e => setBillingDay(Number(e.target.value))} 
                    className={inputClass}
                    placeholder="Ex: 5"
                  />
                </div>

                {/* Status */}
                <div className="space-y-2.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                    Status Inicial
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { val: 'active' as const, label: 'Ativa' },
                      { val: 'pending_payment' as const, label: 'Pendente' },
                      { val: 'draft' as const, label: 'Rascunho' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => setInitialStatus(opt.val)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border-2 ${
                          initialStatus === opt.val 
                            ? 'bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-400' 
                            : 'bg-card border-border text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2.5 pt-2 border-t border-border">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  Observações Internas
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Anotações visíveis apenas para a equipe..."
                  className={`${inputClass} min-h-[80px] resize-y`}
                />
              </div>
            </div>
          )}

          {/* ── STEP: Availability ── */}
          {step === 'availability' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <h3 className="text-sm font-bold text-foreground mb-2 text-center">Verificação de Conflitos</h3>
              
              <div className="p-4 rounded-2xl bg-accent/30 border border-border text-center">
                <div className="text-sm text-foreground">
                  Validando disponibilidade de <strong>{selectedProfessional?.display_name || selectedProfessional?.name}</strong> para toda <strong>{WEEKDAY_NAMES[fixedWeekday]}</strong> às <strong>{fixedTime}</strong>.
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={checkAvailability}
                  disabled={loading}
                  className="btn bg-purple-500 hover:bg-purple-600 text-white border-none py-3 px-6 rounded-xl font-bold shadow-lg shadow-purple-500/20"
                >
                  {loading ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Analisando Agenda...</> : <><MapPin className="w-5 h-5 mr-2" /> Iniciar Verificação</>}
                </button>
              </div>

              {availChecked && (
                <div className="space-y-3 mt-6">
                  {availResults.map((r, i) => (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${
                      r.available ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
                    }`}>
                      <div>
                        <div className="text-sm font-bold text-foreground capitalize">
                          {new Date(r.date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                          Visita {i + 1} • {fixedTime}
                        </div>
                      </div>
                      
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                        r.available ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'
                      }`}>
                        {r.available ? (
                          <><CheckCircle className="w-4 h-4" /> Livre</>
                        ) : (
                          <><XCircle className="w-4 h-4" /> {r.conflictReason}</>
                        )}
                      </div>
                    </div>
                  ))}

                  {hasConflicts && (
                    <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 text-sm font-medium text-center flex items-center justify-center gap-2">
                      <AlertTriangle className="w-5 h-5" /> 
                      Existem conflitos. Altere o dia/horário na etapa anterior.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP: Payment ── */}
          {step === 'payment' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <h3 className="text-sm font-bold text-foreground mb-4">Primeiro Pagamento</h3>
              
              {initialStatus !== 'active' ? (
                <div className="p-8 rounded-3xl border border-dashed border-border bg-accent/20 text-center flex flex-col items-center justify-center">
                  <Clock className="w-8 h-8 text-muted-foreground mb-3" />
                  <div className="text-sm font-bold text-foreground">Pagamento Adiado</div>
                  <div className="text-xs text-muted-foreground mt-1 max-w-[250px]">
                    Como o status inicial não é "Ativa", o pagamento será cobrado futuramente.
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-6 rounded-3xl bg-purple-500/10 border border-purple-500/20 text-center">
                    <div className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1">
                      Valor do Plano
                    </div>
                    <div className="text-3xl font-black text-purple-500">
                      R$ {((isCustomized ? Number(monthlyPriceSnapshot) : selectedPlan?.monthly_price) || 0).toFixed(2).replace('.', ',')}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                      Método de Pagamento
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {['pix', 'dinheiro', 'cartao', 'manual'].map(m => (
                        <button
                          key={m}
                          onClick={() => setPaymentMethod(m)}
                          className={`py-3 px-2 rounded-xl text-xs font-bold transition-all border-2 capitalize ${
                            paymentMethod === m 
                              ? 'bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-400' 
                              : 'bg-card border-border text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          {m === 'cartao' ? 'Cartão' : m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                      Situação
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(['paid', 'pending', 'waived'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setPaymentStatus(s)}
                          className={`py-3 px-2 rounded-xl text-xs font-bold transition-all border-2 ${
                            paymentStatus === s 
                              ? 'bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-500/20' 
                              : 'bg-card border-border text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          {s === 'paid' ? 'Pago Agora' : s === 'pending' ? 'Fica Pendente' : 'Cortesia'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: Confirm ── */}
          {step === 'confirm' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-8 h-8 text-purple-500" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Tudo Pronto</h3>
                <p className="text-sm text-muted-foreground mt-1">Revise os dados antes de finalizar a criação.</p>
              </div>

              {duplicateWarning && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" /> {duplicateWarning}
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-amber-500/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={confirmDuplicate}
                      onChange={e => setConfirmDuplicate(e.target.checked)}
                      className="w-5 h-5 rounded border-amber-500/50 text-amber-500 focus:ring-amber-500 bg-transparent"
                    />
                    <span className="text-sm font-medium">Estou ciente e desejo criar uma assinatura adicional</span>
                  </label>
                </div>
              )}

              <div className="bg-accent/30 border border-border rounded-3xl p-2">
                {[
                  { label: 'Cliente', value: selectedCustomer?.full_name },
                  { label: 'Plano', value: isCustomized ? `${customPlanName} (Personalizado)` : selectedPlan?.display_name },
                  { label: 'Valor', value: `R$ ${((isCustomized ? Number(monthlyPriceSnapshot) : selectedPlan?.monthly_price) || 0).toFixed(2).replace('.', ',')}` },
                  { label: 'Profissional', value: selectedProfessional?.display_name || selectedProfessional?.name },
                  { label: 'Recorrência', value: `${WEEKDAY_NAMES[fixedWeekday].split('-')[0]}s às ${fixedTime}` },
                  { label: 'Dia Pgto', value: `Dia ${billingDay}` },
                  { label: 'Status Inicial', value: initialStatus === 'active' ? 'Ativa' : initialStatus === 'pending_payment' ? 'Pendente' : 'Rascunho' },
                  initialStatus === 'active' ? { label: 'Pagamento', value: `${paymentStatus === 'paid' ? 'Pago' : paymentStatus === 'pending' ? 'Pendente' : 'Cortesia'} via ${paymentMethod}` } : null,
                ].filter(Boolean).map((item, i) => (
                  <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-border/50 last:border-0">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{item!.label}</span>
                    <span className="text-sm font-bold text-foreground text-right">{item!.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-5 md:p-6 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 flex items-center justify-between gap-4">
          <button
            onClick={stepIndex > 0 ? goBack : onClose}
            disabled={creating}
            className="btn btn-secondary px-6"
          >
            {stepIndex > 0 ? (
              <><ChevronLeft className="w-4 h-4 mr-1" /> Voltar</>
            ) : (
              'Cancelar'
            )}
          </button>

          {step === 'confirm' ? (
            <button
              onClick={handleSubmit}
              disabled={creating || (duplicateWarning !== null && !confirmDuplicate)}
              className="btn bg-purple-500 hover:bg-purple-600 text-white border-none px-8 font-bold shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:shadow-none"
            >
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</> : <><Sparkles className="w-4 h-4 mr-2" /> Criar Assinatura</>}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canGoNext()}
              className={`btn px-8 font-bold ${
                canGoNext() 
                  ? 'bg-foreground text-background hover:bg-foreground/90 border-none' 
                  : 'bg-accent text-muted-foreground border-transparent'
              }`}
            >
              Próximo <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
