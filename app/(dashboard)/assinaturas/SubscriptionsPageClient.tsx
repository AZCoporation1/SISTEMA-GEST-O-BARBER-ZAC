"use client"

import { useState, useEffect, useCallback } from 'react'
import {
  CalendarCheck, Crown, RefreshCw, Search, Filter,
  ChevronRight, CheckCircle, XCircle, Clock, AlertCircle,
  Users, DollarSign, TrendingUp, Calendar, Eye, Power,
  Ban
} from 'lucide-react'
import {
  listSubscriptions,
  activateSubscription,
  cancelCustomerSubscription,
  getSubscriptionDetails,
} from '@/features/subscriptions/actions/subscription.actions'
import {
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_COLORS,
  WEEKDAY_NAMES,
  type SubscriptionStatus,
} from '@/features/subscriptions/types'

interface KPICard {
  label: string
  value: string | number
  icon: React.ElementType
  color: string
  bgColor: string
}

export default function SubscriptionsPageClient() {
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<SubscriptionStatus | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSub, setSelectedSub] = useState<any>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const result = await listSubscriptions(
      filterStatus === 'all' ? undefined : { status: filterStatus }
    )
    if (result.success && result.data) {
      setSubscriptions(result.data)
    }
    setLoading(false)
  }, [filterStatus])

  useEffect(() => { loadData() }, [loadData])

  async function handleViewDetails(subId: string) {
    setDetailsLoading(true)
    const result = await getSubscriptionDetails(subId)
    if (result.success && result.data) {
      setSelectedSub(result.data)
    }
    setDetailsLoading(false)
  }

  async function handleActivate(subId: string) {
    if (!confirm('Ativar esta assinatura manualmente? Isso criará os agendamentos.')) return
    setActionLoading(subId)
    const result = await activateSubscription(subId)
    if (result.success) {
      await loadData()
      setSelectedSub(null)
    } else {
      alert(result.error || 'Erro ao ativar.')
    }
    setActionLoading(null)
  }

  async function handleCancel(subId: string) {
    const reason = prompt('Motivo do cancelamento:')
    if (!reason) return
    setActionLoading(subId)
    const result = await cancelCustomerSubscription(subId, reason)
    if (result.success) {
      await loadData()
      setSelectedSub(null)
    } else {
      alert(result.error || 'Erro ao cancelar.')
    }
    setActionLoading(null)
  }

  // ── KPIs ──
  const activeCount = subscriptions.filter(s => s.status === 'active').length
  const pendingCount = subscriptions.filter(s => s.status === 'pending_payment').length
  const cancelledCount = subscriptions.filter(s => s.status === 'cancelled').length
  const monthlyRevenue = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.subscription_plans?.monthly_price || 0), 0)

  const kpis: KPICard[] = [
    { label: 'Ativas', value: activeCount, icon: CheckCircle, color: '#10b981', bgColor: 'rgba(16,185,129,0.1)' },
    { label: 'Pendentes', value: pendingCount, icon: Clock, color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
    { label: 'Canceladas', value: cancelledCount, icon: XCircle, color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' },
    { label: 'Receita Mensal', value: `R$ ${monthlyRevenue.toFixed(2).replace('.', ',')}`, icon: DollarSign, color: '#c026d3', bgColor: 'rgba(192,38,211,0.1)' },
  ]

  const filtered = subscriptions.filter(s => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const customerName = s.customers?.full_name?.toLowerCase() || ''
      const planName = s.subscription_plans?.display_name?.toLowerCase() || ''
      if (!customerName.includes(term) && !planName.includes(term)) return false
    }
    return true
  })

  const statusFilters: Array<{ value: SubscriptionStatus | 'all'; label: string }> = [
    { value: 'all', label: 'Todas' },
    { value: 'active', label: 'Ativas' },
    { value: 'pending_payment', label: 'Pendentes' },
    { value: 'draft', label: 'Rascunho' },
    { value: 'cancelled', label: 'Canceladas' },
  ]

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/10 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Assinaturas</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gerenciamento de planos mensais e assinantes
            </p>
          </div>
        </div>
        <button onClick={loadData} className="btn btn-sm btn-secondary gap-1.5" disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(kpi => (
          <div key={kpi.label} className="p-4 rounded-xl border border-border bg-card/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: kpi.bgColor }}>
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
            </div>
            <div className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-x-auto gap-1.5 hide-scrollbar">
          {statusFilters.map(f => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border btn-press transition-all
                ${filterStatus === f.value
                  ? 'bg-purple-500 text-white border-transparent'
                  : 'bg-card text-muted-foreground border-border hover:bg-accent'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente ou plano..."
            className="w-full pl-8 pr-3 py-2 bg-card border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:border-purple-500/40"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-xl border border-border bg-card/30">
        <table className="table w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Cliente</th>
              <th className="text-left">Plano</th>
              <th className="text-center">Status</th>
              <th className="text-center">Dia/Hora</th>
              <th className="text-right">Preço</th>
              <th className="text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                  <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2" />
                  Carregando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                  <CalendarCheck className="w-8 h-8 mx-auto opacity-30 mb-2" />
                  Nenhuma assinatura encontrada.
                </td>
              </tr>
            ) : (
              filtered.map(sub => {
                const plan = sub.subscription_plans
                const customer = sub.customers
                const statusColor = SUBSCRIPTION_STATUS_COLORS[sub.status as SubscriptionStatus] || '#6b7280'
                const statusLabel = SUBSCRIPTION_STATUS_LABELS[sub.status as SubscriptionStatus] || sub.status

                return (
                  <tr key={sub.id} className="hover:bg-accent/30 transition-colors">
                    <td>
                      <div className="font-medium text-foreground">{customer?.full_name || 'Cliente'}</div>
                      <div className="text-xs text-muted-foreground">{customer?.phone || customer?.email || ''}</div>
                    </td>
                    <td>
                      <div className="text-foreground">{plan?.display_name || plan?.name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{plan?.visits_per_cycle || '?'} visitas/mês</div>
                    </td>
                    <td className="text-center">
                      <span
                        className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: statusColor + '18', color: statusColor }}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="text-center text-xs text-muted-foreground">
                      {WEEKDAY_NAMES[sub.fixed_weekday] || '?'} às {sub.fixed_time || '?'}
                    </td>
                    <td className="text-right font-medium text-foreground">
                      R$ {(plan?.monthly_price || 0).toFixed(2).replace('.', ',')}
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleViewDetails(sub.id)}
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {(sub.status === 'draft' || sub.status === 'pending_payment') && (
                          <button
                            onClick={() => handleActivate(sub.id)}
                            disabled={actionLoading === sub.id}
                            className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-500 transition-colors"
                            title="Ativar manualmente"
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {sub.status !== 'cancelled' && sub.status !== 'expired' && (
                          <button
                            onClick={() => handleCancel(sub.id)}
                            disabled={actionLoading === sub.id}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                            title="Cancelar"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Details Sheet (Modal) */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 animate-fade-in" onClick={() => setSelectedSub(null)}>
          <div
            className="h-full w-full max-w-lg bg-card border-l border-border overflow-y-auto p-6 space-y-6 animate-slide-in-right"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Detalhes da Assinatura</h2>
              <button onClick={() => setSelectedSub(null)} className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
                ✕
              </button>
            </div>

            {/* Customer */}
            <div className="p-4 rounded-xl bg-accent/30 border border-border">
              <div className="text-xs text-muted-foreground mb-1">Cliente</div>
              <div className="font-semibold text-foreground">{selectedSub.customers?.full_name}</div>
              {selectedSub.customers?.phone && (
                <div className="text-xs text-muted-foreground mt-0.5">{selectedSub.customers.phone}</div>
              )}
            </div>

            {/* Plan */}
            <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
              <div className="text-xs text-muted-foreground mb-1">Plano</div>
              <div className="font-semibold text-foreground">{selectedSub.subscription_plans?.display_name}</div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>{selectedSub.subscription_plans?.visits_per_cycle} visitas/mês</span>
                <span>{selectedSub.subscription_plans?.duration_minutes_per_visit}min/visita</span>
                <span className="font-medium text-purple-500">
                  R$ {(selectedSub.subscription_plans?.monthly_price || 0).toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>

            {/* Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-border">
                <div className="text-xs text-muted-foreground mb-1">Status</div>
                <span
                  className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    background: (SUBSCRIPTION_STATUS_COLORS[selectedSub.status as SubscriptionStatus] || '#6b7280') + '18',
                    color: SUBSCRIPTION_STATUS_COLORS[selectedSub.status as SubscriptionStatus] || '#6b7280',
                  }}
                >
                  {SUBSCRIPTION_STATUS_LABELS[selectedSub.status as SubscriptionStatus] || selectedSub.status}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-border">
                <div className="text-xs text-muted-foreground mb-1">Dia fixo</div>
                <div className="text-sm font-medium text-foreground">
                  {WEEKDAY_NAMES[selectedSub.fixed_weekday]} às {selectedSub.fixed_time}
                </div>
              </div>
            </div>

            {/* Occurrences */}
            {selectedSub.subscription_occurrences && selectedSub.subscription_occurrences.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Visitas do Ciclo</h3>
                <div className="space-y-2">
                  {selectedSub.subscription_occurrences
                    .sort((a: any, b: any) => a.occurrence_index - b.occurrence_index)
                    .map((occ: any) => (
                      <div key={occ.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          occ.status === 'used' ? 'bg-emerald-500/10 text-emerald-500' :
                          occ.status === 'scheduled' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-gray-500/10 text-gray-500'
                        }`}>
                          {occ.occurrence_index}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-foreground">{occ.visit_label || `Visita ${occ.occurrence_index}`}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(occ.occurrence_date).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          occ.status === 'used' ? 'bg-emerald-500/10 text-emerald-500' :
                          occ.status === 'scheduled' ? 'bg-blue-500/10 text-blue-500' :
                          occ.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                          'bg-gray-500/10 text-gray-500'
                        }`}>
                          {occ.status === 'used' ? 'Utilizado' :
                           occ.status === 'scheduled' ? 'Agendado' :
                           occ.status === 'cancelled' ? 'Cancelado' : occ.status}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Payments */}
            {selectedSub.payments && selectedSub.payments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Pagamentos</h3>
                <div className="space-y-2">
                  {selectedSub.payments.map((pay: any) => (
                    <div key={pay.id} className="flex items-center justify-between p-3 rounded-xl border border-border">
                      <div>
                        <div className="text-sm text-foreground">
                          R$ {(pay.amount || 0).toFixed(2).replace('.', ',')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {pay.provider} · {pay.payment_method || 'manual'}
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        pay.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' :
                        pay.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        {pay.status === 'paid' ? 'Pago' : pay.status === 'pending' ? 'Pendente' : pay.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-border">
              {(selectedSub.status === 'draft' || selectedSub.status === 'pending_payment') && (
                <button
                  onClick={() => handleActivate(selectedSub.id)}
                  disabled={actionLoading === selectedSub.id}
                  className="flex-1 btn btn-primary gap-1.5"
                >
                  <Power className="w-4 h-4" />
                  Ativar Manualmente
                </button>
              )}
              {selectedSub.status !== 'cancelled' && selectedSub.status !== 'expired' && (
                <button
                  onClick={() => handleCancel(selectedSub.id)}
                  disabled={actionLoading === selectedSub.id}
                  className="flex-1 btn btn-danger gap-1.5"
                >
                  <Ban className="w-4 h-4" />
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
