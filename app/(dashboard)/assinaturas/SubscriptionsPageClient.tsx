"use client"

/**
 * Barber Zac ERP — Subscriptions Page Client (Enhanced)
 *
 * Full admin panel for subscription management with:
 * - 6 KPI cards (active, pending, cancelled, revenue, visits scheduled, upcoming billing)
 * - Advanced filters (status pills, professional, plan, weekday, search)
 * - Enriched table (customer, plan, professional, day/time, billing day, status, usage, actions)
 * - "Nova Assinatura" button → multi-step wizard
 * - Detail sheet with occurrences, payments, admin actions
 */

import { useState, useEffect, useCallback } from 'react'
import {
  CalendarCheck, RefreshCw, Search, Plus,
  CheckCircle, XCircle, Clock, DollarSign,
  Eye, Power, Ban, TrendingUp, CalendarDays,
  Users
} from 'lucide-react'
import {
  listSubscriptions,
  activateSubscription,
  cancelCustomerSubscription,
  getSubscriptionDetails,
  getAdminSubscriptionPlans,
} from '@/features/subscriptions/actions/subscription.actions'
import {
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_COLORS,
  WEEKDAY_NAMES,
  type SubscriptionStatus,
  type SubscriptionPlanWithProfessionals,
} from '@/features/subscriptions/types'
import SubscriptionUsageBar from './SubscriptionUsageBar'
import SubscriptionDetailSheet from './SubscriptionDetailSheet'
import NewSubscriptionWizard from './NewSubscriptionWizard'

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
  const [filterProfessional, setFilterProfessional] = useState('')
  const [filterPlan, setFilterPlan] = useState('')
  const [filterWeekday, setFilterWeekday] = useState<number | ''>('')
  const [searchTerm, setSearchTerm] = useState('')

  const [selectedSub, setSelectedSub] = useState<any>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)

  // Plans and professionals for filter dropdowns
  const [plans, setPlans] = useState<SubscriptionPlanWithProfessionals[]>([])
  const [allProfessionals, setAllProfessionals] = useState<Array<{ id: string; name: string }>>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    const filters: any = {}
    if (filterStatus !== 'all') filters.status = filterStatus
    if (filterProfessional) filters.professionalId = filterProfessional
    if (filterPlan) filters.planId = filterPlan
    if (filterWeekday !== '') filters.weekday = filterWeekday

    const result = await listSubscriptions(filters)
    if (result.success && result.data) {
      setSubscriptions(result.data)
    }
    setLoading(false)
  }, [filterStatus, filterProfessional, filterPlan, filterWeekday])

  // Load plans for filter dropdown
  useEffect(() => {
    getAdminSubscriptionPlans().then(r => {
      if (r.success && r.data) {
        setPlans(r.data)
        // Extract unique professionals from all plans
        const profMap = new Map<string, string>()
        r.data.forEach(p => {
          p.professionals.forEach(prof => {
            profMap.set(prof.id, prof.display_name || prof.name)
          })
        })
        setAllProfessionals(Array.from(profMap.entries()).map(([id, name]) => ({ id, name })))
      }
    })
  }, [])

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
    if (!confirm('Ativar esta assinatura? Isso criará os agendamentos na agenda.')) return
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

  function handleRefreshDetails() {
    if (selectedSub?.id) handleViewDetails(selectedSub.id)
  }

  // ── KPIs ──
  const activeCount = subscriptions.filter(s => s.status === 'active').length
  const pendingCount = subscriptions.filter(s => s.status === 'pending_payment' || s.status === 'draft').length
  const cancelledCount = subscriptions.filter(s => s.status === 'cancelled').length
  const monthlyRevenue = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.subscription_plans?.monthly_price || 0), 0)
  const scheduledVisitsThisWeek = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => {
      const occs = s.subscription_occurrences || []
      const now = new Date()
      const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      return sum + occs.filter((o: any) => {
        if (o.status !== 'scheduled') return false
        const d = new Date(o.occurrence_date)
        return d >= now && d <= weekEnd
      }).length
    }, 0)
  const totalUsed = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.usage?.used || 0), 0)

  const kpis: KPICard[] = [
    { label: 'Ativas', value: activeCount, icon: CheckCircle, color: '#10b981', bgColor: 'rgba(16,185,129,0.1)' },
    { label: 'Pendentes', value: pendingCount, icon: Clock, color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
    { label: 'Canceladas', value: cancelledCount, icon: XCircle, color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' },
    { label: 'Receita Mensal', value: `R$ ${monthlyRevenue.toFixed(2).replace('.', ',')}`, icon: DollarSign, color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.1)' },
    { label: 'Visitas (7 dias)', value: scheduledVisitsThisWeek, icon: CalendarDays, color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
    { label: 'Visitas Usadas', value: totalUsed, icon: TrendingUp, color: '#c026d3', bgColor: 'rgba(192,38,211,0.1)' },
  ]

  // ── Client-side search filter ──
  const filtered = subscriptions.filter(s => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const customerName = s.customers?.full_name?.toLowerCase() || ''
      const planName = s.subscription_plans?.display_name?.toLowerCase() || ''
      const profName = (s.professional_name || '').toLowerCase()
      if (!customerName.includes(term) && !planName.includes(term) && !profName.includes(term)) return false
    }
    return true
  })

  const statusFilters: Array<{ value: SubscriptionStatus | 'all'; label: string; count?: number }> = [
    { value: 'all', label: 'Todas', count: subscriptions.length },
    { value: 'active', label: 'Ativas', count: activeCount },
    { value: 'pending_payment', label: 'Pendentes', count: pendingCount },
    { value: 'draft', label: 'Rascunho' },
    { value: 'past_due', label: 'Atrasadas' },
    { value: 'cancelled', label: 'Canceladas', count: cancelledCount },
  ]

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--card)',
    color: 'var(--text-primary)',
    fontSize: 12,
    minWidth: 130,
  }

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
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="btn btn-sm btn-secondary gap-1.5" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="btn btn-sm gap-1.5"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              color: 'white',
              border: 'none',
              fontWeight: 600,
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Assinatura
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(kpi => (
          <div key={kpi.label} className="p-4 rounded-xl border border-border bg-card/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{kpi.label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: kpi.bgColor }}>
                <kpi.icon className="w-3.5 h-3.5" style={{ color: kpi.color }} />
              </div>
            </div>
            <div className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Status pills */}
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
              {f.count !== undefined && (
                <span className="ml-1 opacity-70">({f.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Advanced filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente, plano ou profissional..."
              className="w-full pl-8 pr-3 py-2 bg-card border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:border-purple-500/40"
            />
          </div>

          {/* Plan filter */}
          <select
            value={filterPlan}
            onChange={e => setFilterPlan(e.target.value)}
            style={selectStyle}
          >
            <option value="">Todos os Planos</option>
            {plans.map(p => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>

          {/* Professional filter */}
          <select
            value={filterProfessional}
            onChange={e => setFilterProfessional(e.target.value)}
            style={selectStyle}
          >
            <option value="">Todos Profissionais</option>
            {allProfessionals.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Weekday filter */}
          <select
            value={filterWeekday}
            onChange={e => setFilterWeekday(e.target.value === '' ? '' : Number(e.target.value))}
            style={selectStyle}
          >
            <option value="">Dia da Semana</option>
            {[1, 2, 3, 4, 5, 6, 0].map(d => (
              <option key={d} value={d}>{WEEKDAY_NAMES[d]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-xl border border-border bg-card/30">
        <table className="table w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Cliente</th>
              <th className="text-left">Plano</th>
              <th className="text-left">Profissional</th>
              <th className="text-center">Dia/Hora</th>
              <th className="text-center">Status</th>
              <th className="text-center">Uso</th>
              <th className="text-right">Preço</th>
              <th className="text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                  <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2" />
                  Carregando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                  <CalendarCheck className="w-8 h-8 mx-auto opacity-30 mb-2" />
                  Nenhuma assinatura encontrada.
                  <br />
                  <button
                    onClick={() => setShowWizard(true)}
                    className="text-purple-500 hover:text-purple-400 text-xs mt-2 underline"
                  >
                    Criar nova assinatura
                  </button>
                </td>
              </tr>
            ) : (
              filtered.map(sub => {
                const plan = sub.subscription_plans
                const customer = sub.customers
                const statusColor = SUBSCRIPTION_STATUS_COLORS[sub.status as SubscriptionStatus] || '#6b7280'
                const statusLabel = SUBSCRIPTION_STATUS_LABELS[sub.status as SubscriptionStatus] || sub.status
                const usage = sub.usage || { used: 0, visitsPerCycle: 0, label: '0/0' }

                return (
                  <tr key={sub.id} className="hover:bg-accent/30 transition-colors cursor-pointer" onClick={() => handleViewDetails(sub.id)}>
                    <td>
                      <div className="font-medium text-foreground">{customer?.full_name || 'Cliente'}</div>
                      <div className="text-xs text-muted-foreground">{customer?.phone || ''}</div>
                    </td>
                    <td>
                      <div className="text-foreground">{plan?.display_name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{plan?.visits_per_cycle || '?'} visitas/mês</div>
                    </td>
                    <td>
                      <div className="text-foreground text-xs font-medium">{sub.professional_name || '—'}</div>
                    </td>
                    <td className="text-center">
                      <div className="text-xs text-foreground font-medium">{WEEKDAY_NAMES[sub.fixed_weekday] || '?'}</div>
                      <div className="text-xs text-muted-foreground">{sub.fixed_time || '?'}</div>
                      {sub.billing_day && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Pgto dia {sub.billing_day}
                        </div>
                      )}
                    </td>
                    <td className="text-center">
                      <span
                        className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: statusColor + '18', color: statusColor }}
                      >
                        {statusLabel}
                      </span>
                      {sub.source === 'internal_admin' && (
                        <div className="text-[9px] text-muted-foreground mt-0.5">interno</div>
                      )}
                    </td>
                    <td className="text-center" onClick={e => e.stopPropagation()}>
                      <SubscriptionUsageBar
                        used={usage.used}
                        total={usage.visitsPerCycle}
                        compact
                      />
                    </td>
                    <td className="text-right font-medium text-foreground whitespace-nowrap">
                      R$ {(plan?.monthly_price || 0).toFixed(2).replace('.', ',')}
                    </td>
                    <td className="text-center" onClick={e => e.stopPropagation()}>
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

      {/* Detail Sheet */}
      {selectedSub && (
        <SubscriptionDetailSheet
          sub={selectedSub}
          onClose={() => setSelectedSub(null)}
          onRefresh={handleRefreshDetails}
        />
      )}

      {/* New Subscription Wizard */}
      {showWizard && (
        <NewSubscriptionWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => { loadData(); setShowWizard(false) }}
        />
      )}
    </div>
  )
}
