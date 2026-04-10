"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { KPICard } from "@/components/ui/kpi-card"
import { DataTable } from "@/components/ui/data-table"
import { DollarSign, TrendingDown, CalendarDays } from "lucide-react"
import Link from "next/link"
import { ExportDialog } from "@/features/import-export/components/ExportDialog"

export default function RelatorioCustosPage() {
  const [fixedCosts, setFixedCosts] = useState<any[]>([])
  const [variableCosts, setVariableCosts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [fc, vc] = await Promise.all([
        supabase.from("fixed_costs").select("*").order("name"),
        supabase.from("variable_costs").select("*").order("occurred_on", { ascending: false }).limit(100),
      ])
      setFixedCosts(fc.data || [])
      setVariableCosts(vc.data || [])
      setIsLoading(false)
    }
    load()
  }, [])

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  const totalFixed = fixedCosts.filter(c => c.is_active).reduce((a, c) => a + Number(c.amount || 0), 0)
  const totalVariable = variableCosts.reduce((a, c) => a + Number(c.amount || 0), 0)
  const combinedExport = [
    ...fixedCosts.map(c => ({ tipo: 'Fixo', status: c.is_active ? 'Ativo' : 'Inativo', ...c })),
    ...variableCosts.map(c => ({ tipo: 'Variável', status: 'Lançado', ...c }))
  ]

  const fixedColumns = [
    { accessorKey: "name", header: "Despesa", cell: ({ row }: any) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "category", header: "Categoria" },
    { accessorKey: "amount", header: "Valor", cell: ({ row }: any) => <span className="font-bold">{fmt(Number(row.original.amount))}</span> },
    { accessorKey: "due_day", header: "Vencimento", cell: ({ row }: any) => <span>{row.original.due_day ? `Dia ${row.original.due_day}` : "—"}</span> },
    { accessorKey: "is_active", header: "Status", cell: ({ row }: any) => <span className={`badge-stock ${row.original.is_active ? 'badge-normal' : 'badge-zerado'}`}>{row.original.is_active ? "Ativo" : "Inativo"}</span> },
  ]

  const variableColumns = [
    { accessorKey: "name", header: "Despesa", cell: ({ row }: any) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "category", header: "Categoria" },
    { accessorKey: "amount", header: "Valor", cell: ({ row }: any) => <span className="font-bold">{fmt(Number(row.original.amount))}</span> },
    { accessorKey: "occurred_on", header: "Data", cell: ({ row }: any) => <span>{new Date(row.original.occurred_on).toLocaleDateString('pt-BR')}</span> },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatório de Custos</h1>
          <p className="page-subtitle">Custos fixos e variáveis do período</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/relatorios" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>← Voltar</Link>
          <ExportDialog data={combinedExport} filename="relatorio-custos" title="Histórico de Custos" />
        </div>
      </div>
      <div className="kpi-grid">
        <KPICard title="Custos Fixos/Mês" value={fmt(totalFixed)} icon={<CalendarDays size={16} />} />
        <KPICard title="Custos Variáveis" value={fmt(totalVariable)} icon={<TrendingDown size={16} />} />
        <KPICard title="Total" value={fmt(totalFixed + totalVariable)} icon={<DollarSign size={16} />} />
      </div>

      <h2 className="text-lg font-semibold mt-4">Custos Fixos</h2>
      <div className="data-table-wrapper p-4">
        {isLoading ? <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando...</div> : <DataTable columns={fixedColumns} data={fixedCosts} />}
      </div>

      <h2 className="text-lg font-semibold mt-4">Custos Variáveis (Recentes)</h2>
      <div className="data-table-wrapper p-4">
        {isLoading ? <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando...</div> : <DataTable columns={variableColumns} data={variableCosts} />}
      </div>
    </div>
  )
}
