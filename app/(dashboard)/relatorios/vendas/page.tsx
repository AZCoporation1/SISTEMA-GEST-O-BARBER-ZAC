"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { KPICard } from "@/components/ui/kpi-card"
import { DataTable } from "@/components/ui/data-table"
import { ShoppingCart, DollarSign, Users } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import Link from "next/link"
import { ExportDialog } from "@/features/import-export/components/ExportDialog"

export default function RelatorioVendasPage() {
  const [sales, setSales] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await (supabase.from("sales") as any)
        .select("*, customer:customer_id(full_name), payment_method:payment_method_id(name)")
        .order("sale_date", { ascending: false })
        .limit(100)
      setSales(data || [])
      setIsLoading(false)
    }
    load()
  }, [])

  const totalRevenue = sales.filter(s => s.status === 'completed').reduce((a, s) => a + Number(s.total || 0), 0)
  const totalDiscount = sales.reduce((a, s) => a + Number(s.discount_amount || 0), 0)
  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const columns = [
    { accessorKey: "sale_date", header: "Data", cell: ({ row }: any) => <span className="text-sm">{format(new Date(row.original.sale_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span> },
    { accessorKey: "customer", header: "Cliente", cell: ({ row }: any) => <span>{row.original.customer?.full_name || "Avulso"}</span> },
    { accessorKey: "payment_method", header: "Pagamento", cell: ({ row }: any) => <span>{row.original.payment_method?.name || "—"}</span> },
    { accessorKey: "subtotal", header: "Subtotal", cell: ({ row }: any) => <span>{fmt(Number(row.original.subtotal))}</span> },
    { accessorKey: "discount_amount", header: "Desconto", cell: ({ row }: any) => <span>{fmt(Number(row.original.discount_amount || 0))}</span> },
    { accessorKey: "total", header: "Total", cell: ({ row }: any) => <span className="font-bold">{fmt(Number(row.original.total))}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }: any) => {
      const s = row.original.status
      const cls = s === 'completed' ? 'badge-normal' : s === 'cancelled' ? 'badge-zerado' : 'badge-critico'
      return <span className={`badge-stock ${cls}`}>{s === 'completed' ? 'Concluída' : s === 'cancelled' ? 'Cancelada' : s}</span>
    }},
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatório de Vendas</h1>
          <p className="page-subtitle">Histórico de vendas realizadas</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/relatorios" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>← Voltar</Link>
          <ExportDialog data={sales} filename="relatorio-vendas" title="Histórico de Vendas" />
        </div>
      </div>
      <div className="kpi-grid">
        <KPICard title="Total de Vendas" value={sales.length.toString()} icon={<ShoppingCart size={16} />} />
        <KPICard title="Receita Total" value={fmt(totalRevenue)} icon={<DollarSign size={16} />} />
        <KPICard title="Descontos Aplicados" value={fmt(totalDiscount)} icon={<Users size={16} />} />
      </div>
      <div className="data-table-wrapper p-4">
        {isLoading ? <div className="h-48 flex items-center justify-center text-muted-foreground">Carregando...</div> : <DataTable columns={columns} data={sales} />}
      </div>
    </div>
  )
}
