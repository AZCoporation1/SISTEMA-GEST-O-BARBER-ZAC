"use client"

/**
 * Barber Zac ERP — Subscription Detail Sheet
 * Full-featured side panel with customer info, plan details, professional,
 * usage timeline, payments, and admin actions (activate, cancel, mark used, revert, register payment).
 */

import { useState } from 'react'
import {
  X, Power, Ban, CheckCircle, RotateCcw, CreditCard,
  Calendar, User, Clock, DollarSign, Edit3, AlertTriangle,
  Receipt
} from 'lucide-react'
import {
  activateSubscription,
  cancelCustomerSubscription,
  markOccurrenceUsedManually,
  revertOccurrenceUsage,
  registerSubscriptionPayment,
  updateSubscriptionSchedule,
} from '@/features/subscriptions/actions/subscription.actions'
import {
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_COLORS,
  WEEKDAY_NAMES,
  OCCURRENCE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  SOURCE_LABELS,
  type SubscriptionStatus,
  type OccurrenceStatus,
  type SubscriptionPaymentStatus,
  type SubscriptionSource,
} from '@/features/subscriptions/types'
import SubscriptionUsageBar from './SubscriptionUsageBar'

interface SubscriptionDetailSheetProps {
  sub: any
  onClose: () => void
  onRefresh: () => void
}

export default function SubscriptionDetailSheet({ sub, onClose, onRefresh }: SubscriptionDetailSheetProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState(sub.subscription_plans?.monthly_price || 0)
  const [paymentMethod, setPaymentMethod] = useState('pix')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending' | 'waived'>('paid')

  const plan = sub.subscription_plans
  const customer = sub.customers
  const occurrences = (sub.subscription_occurrences || []).sort((a: any, b: any) => a.occurrence_index - b.occurrence_index)
  const payments = sub.payments || []
  const usage = sub.usage || { used: 0, visitsPerCycle: 0, remaining: 0, label: '0/0', isComplete: false }
  const statusColor = SUBSCRIPTION_STATUS_COLORS[sub.status as SubscriptionStatus] || '#6b7280'
  const statusLabel = SUBSCRIPTION_STATUS_LABELS[sub.status as SubscriptionStatus] || sub.status

  async function handleActivate() {
    if (!confirm('Ativar esta assinatura? Isso criará os agendamentos na agenda.')) return
    setActionLoading('activate')
    const result = await activateSubscription(sub.id)
    if (result.success) { onRefresh(); onClose() }
    else alert(result.error || 'Erro')
    setActionLoading(null)
  }

  async function handleCancel() {
    const reason = prompt('Motivo do cancelamento:')
    if (!reason) return
    setActionLoading('cancel')
    const result = await cancelCustomerSubscription(sub.id, reason)
    if (result.success) { onRefresh(); onClose() }
    else alert(result.error || 'Erro')
    setActionLoading(null)
  }

  async function handleMarkUsed(occId: string) {
    const reason = prompt('Motivo para marcar como usada:')
    if (!reason) return
    setActionLoading(occId)
    const result = await markOccurrenceUsedManually(occId, reason)
    if (result.success) onRefresh()
    else alert(result.error || 'Erro')
    setActionLoading(null)
  }

  async function handleRevert(occId: string) {
    const reason = prompt('Motivo para reverter consumo (obrigatório):')
    if (!reason || reason.length < 3) { alert('Motivo obrigatório (mínimo 3 caracteres).'); return }
    setActionLoading(occId)
    const result = await revertOccurrenceUsage(occId, reason)
    if (result.success) onRefresh()
    else alert(result.error || 'Erro')
    setActionLoading(null)
  }

  async function handleRegisterPayment() {
    if (paymentAmount <= 0) { alert('Valor deve ser maior que zero.'); return }
    setActionLoading('payment')
    const result = await registerSubscriptionPayment({
      subscriptionId: sub.id,
      amount: paymentAmount,
      paymentMethod,
      status: paymentStatus,
      notes: paymentNotes || undefined,
    })
    if (result.success) {
      setShowPaymentForm(false)
      setPaymentNotes('')
      onRefresh()
    } else {
      alert(result.error || 'Erro')
    }
    setActionLoading(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-lg md:max-w-xl lg:max-w-2xl overflow-y-auto bg-card border-l border-border shadow-2xl animate-slide-in-right"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 md:p-6 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div>
            <h2 className="text-lg font-bold text-foreground">Detalhes da Assinatura</h2>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                style={{ background: `${statusColor}18`, color: statusColor }}
              >
                {statusLabel}
              </span>
              {sub.source && (
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  • {SOURCE_LABELS[sub.source as SubscriptionSource] || sub.source}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 md:p-6 space-y-6">
          {/* Top Section: Customer & Core Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Card */}
            <div className="p-4 rounded-2xl border border-border bg-accent/30 space-y-1">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Cliente
              </div>
              <div className="text-base font-bold text-foreground">
                {customer?.full_name || 'Cliente'}
              </div>
              {customer?.phone && (
                <div className="text-xs text-muted-foreground">{customer.phone}</div>
              )}
              {customer?.email && (
                <div className="text-[11px] text-muted-foreground/70">{customer.email}</div>
              )}
            </div>

            {/* Plan Card */}
            <div className="p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 space-y-1">
              <div className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" /> Plano
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-bold text-foreground">
                    {plan?.display_name || '—'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {plan?.visits_per_cycle} visitas • {plan?.duration_minutes_per_visit}min
                  </div>
                </div>
                <div className="text-sm font-black text-purple-500 bg-purple-500/10 px-2 py-1 rounded-lg">
                  R$ {(plan?.monthly_price || 0).toFixed(2).replace('.', ',')}
                </div>
              </div>
            </div>
          </div>

          {/* Professional & Schedule Card */}
          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                Profissional Atribuído
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-sm">
                  {sub.professional_name ? sub.professional_name[0].toUpperCase() : '?'}
                </div>
                <div className="text-sm font-bold text-foreground">
                  {sub.professional_name || 'Não atribuído'}
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap md:flex-nowrap items-center gap-3 md:gap-5 text-xs text-muted-foreground font-medium">
              <div className="flex items-center gap-1.5 bg-accent/50 px-2.5 py-1.5 rounded-lg">
                <Calendar className="w-3.5 h-3.5" /> {WEEKDAY_NAMES[sub.fixed_weekday] || '?'}
              </div>
              <div className="flex items-center gap-1.5 bg-accent/50 px-2.5 py-1.5 rounded-lg">
                <Clock className="w-3.5 h-3.5" /> {sub.fixed_time || '?'}
              </div>
              {sub.billing_day && (
                <div className="flex items-center gap-1.5 bg-accent/50 px-2.5 py-1.5 rounded-lg text-emerald-600/80 dark:text-emerald-400/80">
                  <DollarSign className="w-3.5 h-3.5" /> Dia {sub.billing_day}
                </div>
              )}
            </div>
          </div>

          {/* Usage Bar */}
          <div className="p-5 rounded-2xl border border-border bg-card shadow-sm">
            <SubscriptionUsageBar used={usage.used} total={usage.visitsPerCycle} />
          </div>

          {/* Occurrences Timeline */}
          {occurrences.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground">
                Visitas do Ciclo Atual
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {occurrences.map((occ: any) => {
                  const isUsed = occ.status === 'used'
                  const isScheduled = occ.status === 'scheduled'
                  const isCancelled = occ.status === 'cancelled'
                  
                  return (
                    <div key={occ.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      isUsed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-card border-border hover:border-accent'
                    }`}>
                      {/* Badge Number */}
                      <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-sm font-black ${
                        isUsed ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 
                        isScheduled ? 'bg-blue-500/10 text-blue-500' : 
                        'bg-accent text-muted-foreground'
                      }`}>
                        {isUsed ? <CheckCircle className="w-5 h-5" /> : occ.occurrence_index}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-foreground truncate">
                          {occ.visit_label || `Visita ${occ.occurrence_index}`}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-col xl:flex-row xl:items-center gap-1">
                          <span>{new Date(occ.occurrence_date).toLocaleDateString('pt-BR')}</span>
                          {isUsed && occ.used_at && (
                            <span className="text-emerald-600/80 dark:text-emerald-400/80 font-medium">
                              • Check-in {new Date(occ.used_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Actions & Status */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isUsed ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 
                          isScheduled ? 'bg-blue-500/10 text-blue-500' : 
                          isCancelled ? 'bg-red-500/10 text-red-500' : 
                          'bg-accent text-muted-foreground'
                        }`}>
                          {OCCURRENCE_STATUS_LABELS[occ.status as OccurrenceStatus] || occ.status}
                        </span>
                        
                        <div className="flex items-center gap-1">
                          {isScheduled && (
                            <button
                              onClick={() => handleMarkUsed(occ.id)}
                              disabled={actionLoading === occ.id}
                              title="Marcar como usada"
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isUsed && (
                            <button
                              onClick={() => handleRevert(occ.id)}
                              disabled={actionLoading === occ.id}
                              title="Reverter consumo"
                              className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Payments */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">
                Pagamentos
              </h3>
              <button
                onClick={() => setShowPaymentForm(!showPaymentForm)}
                className="btn btn-sm btn-secondary gap-1.5 text-xs text-purple-500 border-purple-500/20 hover:bg-purple-500/10"
              >
                <CreditCard className="w-3.5 h-3.5" /> Registrar Pagamento
              </button>
            </div>

            {/* Payment Form */}
            {showPaymentForm && (
              <div className="p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase">Valor R$</label>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase">Método</label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
                    >
                      <option value="pix">PIX</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="cartao">Cartão</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase">Status</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['paid', 'pending', 'waived'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setPaymentStatus(s)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                          paymentStatus === s 
                            ? 'bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-500/20' 
                            : 'bg-card text-muted-foreground border-border hover:bg-accent'
                        }`}
                      >
                        {s === 'paid' ? 'Pago' : s === 'pending' ? 'Pendente' : 'Cortesia'}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase">Observação</label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                    placeholder="Detalhes opcionais..."
                    className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowPaymentForm(false)}
                    className="flex-1 btn btn-secondary text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRegisterPayment}
                    disabled={actionLoading === 'payment'}
                    className="flex-1 btn bg-purple-500 hover:bg-purple-600 text-white border-none text-xs"
                  >
                    {actionLoading === 'payment' ? 'Salvando...' : 'Confirmar Registro'}
                  </button>
                </div>
              </div>
            )}

            {/* Payment list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {payments.length === 0 ? (
                <div className="col-span-full p-6 text-center rounded-2xl border border-dashed border-border text-muted-foreground text-sm">
                  Nenhum pagamento registrado.
                </div>
              ) : (
                payments.map((pay: any) => (
                  <div key={pay.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-purple-500/30 transition-colors">
                    <div>
                      <div className="text-base font-bold text-foreground">
                        R$ {(pay.amount || 0).toFixed(2).replace('.', ',')}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 capitalize font-medium flex items-center gap-1.5">
                        <CreditCard className="w-3 h-3" />
                        {pay.payment_method || 'manual'} • {pay.paid_at ? new Date(pay.paid_at).toLocaleDateString('pt-BR') : pay.created_at ? new Date(pay.created_at).toLocaleDateString('pt-BR') : ''}
                      </div>
                    </div>
                    <span 
                      className="text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider"
                      style={{
                        background: (PAYMENT_STATUS_COLORS[pay.status as SubscriptionPaymentStatus] || '#6b7280') + '20',
                        color: PAYMENT_STATUS_COLORS[pay.status as SubscriptionPaymentStatus] || '#6b7280',
                      }}
                    >
                      {PAYMENT_STATUS_LABELS[pay.status as SubscriptionPaymentStatus] || pay.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Notes */}
          {sub.notes && (
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
              <div className="text-[10px] font-bold text-amber-600/80 dark:text-amber-400/80 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5" /> Observações Internas
              </div>
              <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {sub.notes}
              </div>
            </div>
          )}

          {/* Admin Actions Footer */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border">
            {(sub.status === 'draft' || sub.status === 'pending_payment') && (
              <button
                onClick={handleActivate}
                disabled={!!actionLoading}
                className="flex-1 btn bg-emerald-500 hover:bg-emerald-600 text-white border-none gap-2 font-bold"
              >
                <Power className="w-4 h-4" /> Ativar Assinatura
              </button>
            )}
            {sub.status !== 'cancelled' && sub.status !== 'expired' && (
              <button
                onClick={handleCancel}
                disabled={!!actionLoading}
                className="flex-1 btn btn-danger gap-2 font-bold"
              >
                <Ban className="w-4 h-4" /> Cancelar Assinatura
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
