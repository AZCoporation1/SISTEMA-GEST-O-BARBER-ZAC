"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { KPICard } from "@/components/ui/kpi-card"
import { DataTable } from "@/components/ui/data-table"
import { Package, AlertTriangle, TrendingUp, DollarSign } from "lucide-react"
import Link from "next/link"
import { ExportDialog } from "@/features/import-export/components/ExportDialog"

export default function RelatorioEstoquePage() {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: inv } = await supabase.from("vw_inventory_position").select("*").order("product_name")
      setData(inv || [])
      setIsLoading(false)
    }
    load()
  }, [])

  const totalCost = data.reduce((a, p) => a + (p.current_balance || 0) * (p.cost_price || 0), 0)
  const totalSale = data.reduce((a, p) => a + (p.current_balance || 0) * (p.sale_price || 0), 0)
  const critical = data.filter(p => p.stock_status === 'sem_estoque' || p.stock_status === 'abaixo_do_minimo')
  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const columns = [
    { accessorKey: "product_name", header: "Produto", cell: ({ row }: any) => {
      const code = row.original.external_code || null
      return (
        <div className="flex items-center gap-2">
          {code && <span className="text-[11px] font-semibold tracking-wider text-[var(--accent)] font-mono bg-[var(--accent-subtle)] px-1.5 py-0.5 rounded" style={{ letterSpacing: '0.06em' }}>{code}</span>}
          <span className="font-medium">{row.original.product_name}</span>
        </div>
      )
    }},
    { accessorKey: "category_name", header: "Categoria" },
    { accessorKey: "current_balance", header: "Saldo", cell: ({ row }: any) => <span className="font-bold">{row.original.current_balance}</span> },
    { accessorKey: "min_stock", header: "Mínimo" },
    { accessorKey: "max_stock", header: "Máximo" },
    { accessorKey: "cost_price", header: "Custo", cell: ({ row }: any) => <span>{fmt(row.original.cost_price)}</span> },
    { accessorKey: "sale_price", header: "Venda", cell: ({ row }: any) => <span>{fmt(row.original.sale_price)}</span> },
    { accessorKey: "stock_status", header: "Status", cell: ({ row }: any) => {
      const s = row.original.stock_status
      const cls = s === 'sem_estoque' ? 'badge-zerado' : s === 'abaixo_do_minimo' ? 'badge-critico' : s === 'acima_do_maximo' ? 'badge-excesso' : 'badge-normal'
      const label = s === 'sem_estoque' ? 'Zerado' : s === 'abaixo_do_minimo' ? 'Crítico' : s === 'acima_do_maximo' ? 'Excesso' : 'Normal'
      return <span className={`badge-stock ${cls}`}>{label}</span>
    }},
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatório de Estoque</h1>
          <p className="page-subtitle">Posição atual de todos os produtos</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/relatorios" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>← Voltar</Link>
          <ExportDialog data={data} filename="relatorio-estoque-barberzac" title="Posição de Estoque" />
        </div>
      </div>
      <div className="kpi-grid">
        <KPICard title="Total Produtos" value={data.length.toString()} icon={<Package size={16} />} />
        <KPICard title="Valor a Custo" value={fmt(totalCost)} icon={<DollarSign size={16} />} />
        <KPICard title="Valor a Venda" value={fmt(totalSale)} icon={<TrendingUp size={16} />} />
        <KPICard title="Produtos Críticos" value={critical.length.toString()} icon={<AlertTriangle size={16} />} className={critical.length > 0 ? "border-red-500/30" : ""} />
      </div>
      <div className="data-table-wrapper p-4">
        {isLoading ? <div className="h-48 flex items-center justify-center text-muted-foreground">Carregando...</div> : <DataTable columns={columns} data={data} />}
      </div>
    </div>
  )
}
