"use client"

import { useEffect, useState } from "react"
import {
  Package,
  AlertTriangle,
  ShoppingCart,
  Wallet,
  Clock,
  ArrowUp,
  ArrowDown,
  TrendingUp,
} from 'lucide-react'
import { createClient } from "@/lib/supabase/client"
import { AlertsPanel } from '@/features/ai-operator/components/AlertsPanel'
import { KPICard } from "@/components/ui/kpi-card"
import { useAppSettings } from "@/features/settings/hooks/useSettings"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface DashboardData {
  totalStockCost: number
  totalStockSale: number
  totalProducts: number
  criticalCount: number
  salesToday: number
  revenueTodayTotal: number
  cashStatus: string
  cashBalance: number
  recentSales: any[]
  recentMovements: any[]
  monthRevenue: number
  monthExpenses: number
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { organizationName } = useAppSettings()

  useEffect(() => {
    async function loadDashboard() {
      try {
        const supabase = createClient()
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const monthStart = new Date()
        monthStart.setDate(1)
        monthStart.setHours(0, 0, 0, 0)

        const [
          inventoryRes,
          salesTodayRes,
          cashRes,
          recentSalesRes,
          recentMovementsRes,
          financialRes,
        ] = await Promise.all([
          supabase.from("vw_inventory_position").select("*"),
          supabase.from("sales").select("total, status").gte("sale_date", todayStart.toISOString()).eq("status", "completed"),
          supabase.from("cash_sessions").select("opening_amount, closing_amount, status").eq("status", "open").order("opened_at", { ascending: false }).limit(1),
          supabase.from("sales").select("id, total, sale_date, status, customer:customer_id(full_name)").order("created_at", { ascending: false }).limit(5),
          supabase.from("stock_movements").select("id, movement_type, quantity, movement_date, product:product_id(name)").order("created_at", { ascending: false }).limit(5),
          supabase.from("financial_movements").select("movement_type, amount, category").gte("occurred_on", monthStart.toISOString()),
        ])

        const inventory = (inventoryRes.data || []) as any[]
        const totalStockCost = inventory.reduce((acc, p) => acc + ((p.current_balance || 0) * (p.cost_price || 0)), 0)
        const totalStockSale = inventory.reduce((acc, p) => acc + ((p.current_balance || 0) * (p.sale_price || 0)), 0)
        const criticalCount = inventory.filter(p => p.stock_status === 'sem_estoque' || p.stock_status === 'abaixo_do_minimo').length

        const revenueTodayTotal = (salesTodayRes.data || []).reduce((acc: number, s: any) => acc + Number(s.total || 0), 0)

        const cashSession = (cashRes.data?.[0] || null) as any
        const cashStatus = cashSession ? "Aberto" : "Fechado"
        const cashBalance = cashSession ? Number(cashSession.opening_amount || 0) : 0

        const financials = (financialRes.data || []) as any[]
        const monthRevenue = financials.filter(f => f.movement_type === 'received').reduce((a, f) => a + Number(f.amount || 0), 0)
        const monthExpenses = financials.filter(f => f.movement_type === 'paid').reduce((a, f) => a + Number(f.amount || 0), 0)

        setData({
          totalStockCost,
          totalStockSale,
          totalProducts: inventory.length,
          criticalCount,
          salesToday: (salesTodayRes.data || []).length,
          revenueTodayTotal,
          cashStatus,
          cashBalance,
          recentSales: recentSalesRes.data || [],
          recentMovements: recentMovementsRes.data || [],
          monthRevenue,
          monthExpenses,
        })
      } catch (e) {
        console.error("Dashboard load error:", e)
      } finally {
        setIsLoading(false)
      }
    }
    loadDashboard()
  }, [])

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Carregando dados operacionais...</p>
          </div>
        </div>
        <div className="kpi-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="kpi-card animate-pulse">
              <div className="kpi-header"><span className="kpi-label">Carregando...</span></div>
              <div className="kpi-value" style={{ opacity: 0.3 }}>—</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const d = data!
  const netProfit = d.monthRevenue - d.monthExpenses

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral operacional — {organizationName}</p>
        </div>
        <div className="page-actions">
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        <KPICard
          title="Estoque (Custo)"
          value={fmt(d.totalStockCost)}
          description={`${d.totalProducts} produtos | Venda: ${fmt(d.totalStockSale)}`}
          icon={<Package size={16} />}
        />
        <KPICard
          title="Vendas Hoje"
          value={fmt(d.revenueTodayTotal)}
          description={`${d.salesToday} venda${d.salesToday !== 1 ? 's' : ''} registrada${d.salesToday !== 1 ? 's' : ''}`}
          icon={<ShoppingCart size={16} />}
        />
        <KPICard
          title="Saldo do Caixa"
          value={d.cashStatus === "Aberto" ? fmt(d.cashBalance) : "Fechado"}
          description={d.cashStatus === "Aberto" ? "Caixa aberto" : "Nenhum caixa aberto"}
          icon={<Wallet size={16} />}
        />
        <KPICard
          title="Produtos Críticos"
          value={d.criticalCount.toString()}
          description="abaixo do mínimo ou zerados"
          icon={<AlertTriangle size={16} />}
          className={d.criticalCount > 0 ? "border-red-500/30" : ""}
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-full">
        {/* Alertas */}
        <div>
          <AlertsPanel />
        </div>

        {/* Últimas Vendas */}
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title flex items-center gap-2">
              <ShoppingCart size={16} /> Últimas Vendas
            </span>
            <Link href="/vendas" className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-light)] transition-colors">
              Ver todas →
            </Link>
          </div>
          <div className="section-card-body p-0">
            {d.recentSales.length === 0 ? (
              <div className="empty-state !m-4">
                <ShoppingCart className="empty-state-icon" />
                <h3 className="empty-state-title">Nenhuma venda</h3>
                <p className="empty-state-description">
                  As vendas registradas aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {d.recentSales.map((sale: any) => (
                  <div key={sale.id} className="flex justify-between items-center px-6 py-4 border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {(sale.customer as any)?.full_name || "Cliente Avulso"}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] font-medium">
                        {format(new Date(sale.sale_date), "dd/MM 'às' HH:mm")}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-[var(--success)]">
                      {fmt(Number(sale.total))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-full">
        {/* Últimas Movimentações */}
        <div className="section-card lg:col-span-2">
          <div className="section-card-header">
            <span className="section-card-title flex items-center gap-2">
              <Clock size={16} /> Últimas Movimentações
            </span>
            <Link href="/movimentacoes" className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-light)] transition-colors">
              Ver todas →
            </Link>
          </div>
          <div className="section-card-body p-0">
            {d.recentMovements.length === 0 ? (
              <div className="empty-state !m-4">
                <Clock className="empty-state-icon" />
                <h3 className="empty-state-title">Sem movimentações</h3>
                <p className="empty-state-description">
                  Nenhuma movimentação de estoque recente.
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {d.recentMovements.map((mov: any) => {
                  const isEntry = ['initial_balance', 'purchase_entry', 'manual_adjustment_in', 'return_from_customer'].includes(mov.movement_type)
                  return (
                    <div key={mov.id} className="flex justify-between items-center px-6 py-4 border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg flex items-center justify-center ${isEntry ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--danger-bg)] text-[var(--danger)]'}`}>
                          {isEntry ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {(mov.product as any)?.name || "Produto Removido"}
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            {mov.movement_type.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      <span className={`text-sm font-bold ${isEntry ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        {isEntry ? "+" : "-"}{Math.abs(mov.quantity)} un.
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Resumo Financeiro */}
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title">Resumo do Mês</span>
          </div>
          <div className="section-card-body">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <ArrowUp size={12} style={{ color: 'var(--success)' }} /> Receitas
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--success)' }}>{fmt(d.monthRevenue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <ArrowDown size={12} style={{ color: 'var(--danger)' }} /> Despesas
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>{fmt(d.monthExpenses)}</span>
              </div>
              <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Resultado</span>
                  <span className="text-base font-bold" style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {fmt(netProfit)}
                  </span>
                </div>
              </div>
              <Link
                href="/fluxo-de-caixa"
                className="text-xs font-semibold text-center mt-1"
                style={{ color: 'var(--accent)' }}
              >
                Ver fluxo completo →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
