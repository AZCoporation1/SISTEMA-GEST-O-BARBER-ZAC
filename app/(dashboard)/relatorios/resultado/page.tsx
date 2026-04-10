"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { KPICard } from "@/components/ui/kpi-card"
import { ArrowUp, ArrowDown, TrendingUp } from "lucide-react"
import Link from "next/link"
import { ExportDialog } from "@/features/import-export/components/ExportDialog"

export default function RelatorioResultadoPage() {
  const [data, setData] = useState<{ monthRevenue: number; monthExpenses: number; fixedCosts: number }>({ monthRevenue: 0, monthExpenses: 0, fixedCosts: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const [finRes, fixedRes] = await Promise.all([
        supabase.from("financial_movements").select("movement_type, amount, category").gte("occurred_on", monthStart.toISOString()),
        supabase.from("fixed_costs").select("amount").eq("is_active", true),
      ])

      const financials = finRes.data || []
      const monthRevenue = financials.filter((f: any) => f.movement_type === 'received').reduce((a: number, f: any) => a + Number(f.amount || 0), 0)
      const monthExpenses = financials.filter((f: any) => f.movement_type === 'paid').reduce((a: number, f: any) => a + Number(f.amount || 0), 0)
      const fixedCosts = (fixedRes.data || []).reduce((a: number, c: any) => a + Number(c.amount || 0), 0)

      setData({ monthRevenue, monthExpenses, fixedCosts })
      setIsLoading(false)
    }
    load()
  }, [])

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  const netProfit = data.monthRevenue - data.monthExpenses
  const margin = data.monthRevenue > 0 ? (netProfit / data.monthRevenue * 100).toFixed(1) : "0.0"

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Resultado do Período</h1>
          <p className="page-subtitle">DRE simplificado do mês atual</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/relatorios" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>← Voltar</Link>
          <ExportDialog 
            data={[
              { Categoria: "Receita Bruta (Vendas + Outros)", Valor: data.monthRevenue },
              { Categoria: "(-) Despesas Operacionais", Valor: data.monthExpenses },
              { Categoria: "(-) Custos Fixos Previstos", Valor: data.fixedCosts },
              { Categoria: "Resultado Líquido", Valor: netProfit }
            ]} 
            filename="dre-simplificado" 
            title="DRE Simplificado" 
          />
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground">Carregando resultado...</div>
      ) : (
        <>
          <div className="kpi-grid">
            <KPICard title="Receita Bruta" value={fmt(data.monthRevenue)} icon={<ArrowUp size={16} />} />
            <KPICard title="Despesas Totais" value={fmt(data.monthExpenses)} icon={<ArrowDown size={16} />} />
            <KPICard title="Custos Fixos/Mês" value={fmt(data.fixedCosts)} description="Previsto no mês" icon={<ArrowDown size={16} />} />
            <KPICard
              title="Resultado Líquido"
              value={fmt(netProfit)}
              description={`Margem: ${margin}%`}
              icon={<TrendingUp size={16} />}
              className={netProfit >= 0 ? "border-emerald-500/30" : "border-red-500/30"}
            />
          </div>

          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">Demonstração Simplificada</span>
            </div>
            <div className="section-card-body">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Receita Bruta (Vendas + Outros)</span>
                  <span className="font-bold" style={{ color: 'var(--success)' }}>{fmt(data.monthRevenue)}</span>
                </div>
                <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>(-) Despesas Operacionais</span>
                  <span className="font-bold" style={{ color: 'var(--danger)' }}>- {fmt(data.monthExpenses)}</span>
                </div>
                <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>(-) Custos Fixos Previstos</span>
                  <span className="font-bold" style={{ color: 'var(--danger)' }}>- {fmt(data.fixedCosts)}</span>
                </div>
                <div className="flex justify-between items-center py-3 mt-2" style={{ borderTop: '2px solid var(--accent-border)' }}>
                  <span className="text-base font-bold">Resultado do Período</span>
                  <span className="text-xl font-bold" style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {fmt(netProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
