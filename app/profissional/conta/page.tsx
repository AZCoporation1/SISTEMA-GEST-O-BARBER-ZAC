'use client'

import { useAuth } from '@/components/auth-provider'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Wallet, TrendingUp, TrendingDown, DollarSign, Clock, Scissors, Package, AlertCircle } from 'lucide-react'

interface PeriodSummary {
  periodLabel: string
  periodStart: string
  periodEnd: string
  grossSales: number
  serviceCount: number
  productSales: number
  commissionPercent: number
  commissionEstimate: number
  advancesTotal: number
  stockWithdrawals: number
  netEstimate: number
  pendingRequests: number
  approvedRequests: number
}

export default function ContaPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<PeriodSummary | null>(null)
  const [recentAdvances, setRecentAdvances] = useState<any[]>([])
  const [recentCommissions, setRecentCommissions] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    if (!user?.collaboratorId) {
      setLoading(false)
      return
    }

    const supabase = createClient()
    const now = new Date()
    const day = now.getDate()

    // Current fortnight period
    let periodStart: Date, periodEnd: Date, periodLabel: string
    if (day <= 15) {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      periodEnd = new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59)
      periodLabel = `1ª Quinzena — ${now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
    } else {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 16)
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      periodLabel = `2ª Quinzena — ${now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
    }

    const startStr = periodStart.toISOString().split('T')[0]
    const endStr = periodEnd.toISOString().split('T')[0]

    // Fetch in parallel
    const [salesRes, commissionsRes, advancesRes, requestsRes, collabRes] = await Promise.all([
      // Sales by this professional in the period
      supabase
        .from('sales')
        .select('id, total, sale_date, status')
        .eq('collaborator_id', user.collaboratorId)
        .gte('sale_date', startStr)
        .lte('sale_date', endStr)
        .neq('status', 'cancelled'),

      // Commission entries for this professional in the period
      supabase
        .from('commission_entries')
        .select('id, commission_amount, base_amount, status, competence_date')
        .eq('collaborator_id', user.collaboratorId)
        .gte('competence_date', startStr)
        .lte('competence_date', endStr),

      // Professional advances in the period
      supabase
        .from('professional_advances')
        .select('id, type, source_method, description, total_amount, quantity, unit_amount, occurred_at, status, product_id')
        .eq('professional_id', user.collaboratorId)
        .gte('occurred_at', startStr)
        .lte('occurred_at', endStr + 'T23:59:59Z')
        .neq('status', 'cancelled')
        .order('occurred_at', { ascending: false }),

      // Pending/approved requests
      supabase
        .from('professional_requests')
        .select('id, status, created_at')
        .eq('professional_id', user.collaboratorId)
        .gte('created_at', startStr)
        .lte('created_at', endStr + 'T23:59:59Z'),

      // Collaborator info for commission %
      supabase
        .from('collaborators')
        .select('default_commission_percent')
        .eq('id', user.collaboratorId)
        .single(),
    ])

    const sales = (salesRes.data || []) as any[]
    const commissions = (commissionsRes.data || []) as any[]
    const advances = (advancesRes.data || []) as any[]
    const requests = (requestsRes.data || []) as any[]
    const commissionPercent = (collabRes.data as any)?.default_commission_percent || 50

    const grossSales = sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0)
    const serviceCount = sales.length
    const totalCommission = commissions.reduce((sum: number, c: any) => sum + (c.commission_amount || 0), 0)
    const advancesTotal = advances.filter((a: any) => a.type !== 'stock_consumption').reduce((sum: number, a: any) => sum + (a.total_amount || 0), 0)
    const stockWithdrawals = advances.filter((a: any) => a.type === 'stock_consumption').reduce((sum: number, a: any) => sum + (a.total_amount || 0), 0)
    const commissionEstimate = totalCommission > 0 ? totalCommission : grossSales * (commissionPercent / 100)
    const netEstimate = commissionEstimate - advancesTotal - stockWithdrawals

    setSummary({
      periodLabel,
      periodStart: startStr,
      periodEnd: endStr,
      grossSales,
      serviceCount,
      productSales: 0,
      commissionPercent,
      commissionEstimate,
      advancesTotal,
      stockWithdrawals,
      netEstimate,
      pendingRequests: requests.filter((r: any) => r.status === 'pending').length,
      approvedRequests: requests.filter((r: any) => r.status === 'approved').length,
    })

    setRecentAdvances(advances.slice(0, 5))
    setRecentCommissions(commissions.slice(0, 5))
    setLoading(false)
  }, [user?.collaboratorId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (!user?.collaboratorId) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Minha Conta</h1>
            <p className="page-subtitle">Resumo do período e comissões</p>
          </div>
        </div>
        <div className="section-card">
          <div className="section-card-body">
            <div className="empty-state" style={{ border: 'none', margin: 0, padding: '48px 24px' }}>
              <AlertCircle className="empty-state-icon" />
              <div className="empty-state-title">Perfil não vinculado</div>
              <div className="empty-state-description">
                Seu perfil não está vinculado a um profissional. Contate a administração.
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Minha Conta</h1>
          <p className="page-subtitle">
            {loading ? 'Carregando...' : summary?.periodLabel || 'Resumo do período'}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Calculando quinzena...
        </div>
      ) : summary ? (
        <>
          {/* KPIs */}
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            {/* Gross Sales */}
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-label">Faturamento Bruto</span>
                <div className="kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="kpi-value" style={{ color: 'var(--success)' }}>
                R$ {summary.grossSales.toFixed(2)}
              </div>
              <div className="kpi-footer">
                {summary.serviceCount} atendimento(s)
              </div>
            </div>

            {/* Commission Estimate */}
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-label">Comissão ({summary.commissionPercent}%)</span>
                <div className="kpi-icon" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                  <DollarSign size={18} />
                </div>
              </div>
              <div className="kpi-value">
                R$ {summary.commissionEstimate.toFixed(2)}
              </div>
            </div>

            {/* Advances */}
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-label">Adiantamentos</span>
                <div className="kpi-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                  <TrendingDown size={18} />
                </div>
              </div>
              <div className="kpi-value" style={{ color: 'var(--danger)' }}>
                -R$ {summary.advancesTotal.toFixed(2)}
              </div>
            </div>

            {/* Stock Withdrawals */}
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-label">Retiradas Estoque</span>
                <div className="kpi-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                  <Package size={18} />
                </div>
              </div>
              <div className="kpi-value" style={{ color: 'var(--warning)' }}>
                -R$ {summary.stockWithdrawals.toFixed(2)}
              </div>
            </div>

            {/* Net Estimate */}
            <div className="kpi-card" style={{ borderColor: summary.netEstimate >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)' }}>
              <div className="kpi-header">
                <span className="kpi-label">Líquido Estimado</span>
                <div className="kpi-icon" style={{ background: summary.netEstimate >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)', color: summary.netEstimate >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  <Wallet size={18} />
                </div>
              </div>
              <div className="kpi-value" style={{ color: summary.netEstimate >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: 24 }}>
                R$ {summary.netEstimate.toFixed(2)}
              </div>
            </div>

            {/* Pending Requests */}
            <div className="kpi-card">
              <div className="kpi-header">
                <span className="kpi-label">Solicitações</span>
                <div className="kpi-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                  <Clock size={18} />
                </div>
              </div>
              <div className="kpi-value">
                {summary.pendingRequests}
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 4 }}>pendente(s)</span>
              </div>
              <div className="kpi-footer">
                {summary.approvedRequests} aprovada(s) no período
              </div>
            </div>
          </div>

          {/* Period info bar */}
          <div className="section-card" style={{ marginTop: 16, marginBottom: 16 }}>
            <div className="section-card-body" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Scissors size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Período: {new Date(summary.periodStart).toLocaleDateString('pt-BR')} a {new Date(summary.periodEnd).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                Comissão base: {summary.commissionPercent}% · Os valores são estimativas até o fechamento oficial.
              </span>
            </div>
          </div>

          {/* Recent Advances */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">Adiantamentos / Deduções Recentes</span>
            </div>
            <div className="section-card-body" style={{ padding: 0 }}>
              {recentAdvances.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                  Nenhum adiantamento no período
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {recentAdvances.map((adv: any) => (
                    <div key={adv.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 20px', borderBottom: '1px solid var(--border)', gap: 12,
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {adv.description}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {new Date(adv.occurred_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {adv.type === 'stock_consumption' ? 'Retirada' : adv.type === 'cash_advance' ? 'Adiantamento' : adv.type === 'manual_deduction' ? 'Dedução' : adv.source_method}
                        </div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        -R$ {adv.total_amount?.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
