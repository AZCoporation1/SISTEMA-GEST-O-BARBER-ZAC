"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { KPICard } from "@/components/ui/kpi-card"
import { DataTable } from "@/components/ui/data-table"
import { ArrowDownRight, ArrowUpRight, Clock } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ExportDialog } from "@/features/import-export/components/ExportDialog"

const MOVEMENT_LABELS: Record<string, string> = {
  initial_balance: "Saldo Inicial", purchase_entry: "Entrada de Compra", manual_adjustment_in: "Ajuste (Entrada)",
  return_from_customer: "Retorno", sale_exit: "Saída (Venda)", internal_consumption: "Consumo Interno",
  loss: "Perda", damage: "Dano", manual_adjustment_out: "Ajuste (Saída)",
}

export default function RelatorioMovimentacoesPage() {
  const [movements, setMovements] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await (supabase.from("stock_movements") as any)
        .select("*, product:product_id(name), performed_by_user:performed_by(full_name)")
        .order("created_at", { ascending: false })
        .limit(200)
      setMovements(data || [])
      setIsLoading(false)
    }
    load()
  }, [])

  const entries = movements.filter(m => ['initial_balance', 'purchase_entry', 'manual_adjustment_in', 'return_from_customer'].includes(m.movement_type))
  const exits = movements.filter(m => !['initial_balance', 'purchase_entry', 'manual_adjustment_in', 'return_from_customer'].includes(m.movement_type))

  const columns = [
    { accessorKey: "movement_date", header: "Data", cell: ({ row }: any) => <span className="text-sm">{format(new Date(row.original.movement_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span> },
    { accessorKey: "product", header: "Produto", cell: ({ row }: any) => <span className="font-medium">{row.original.product?.name || "—"}</span> },
    { accessorKey: "movement_type", header: "Tipo", cell: ({ row }: any) => {
      const isEntry = ['initial_balance', 'purchase_entry', 'manual_adjustment_in', 'return_from_customer'].includes(row.original.movement_type)
      return <Badge variant={isEntry ? "default" : "destructive"} className={isEntry ? "bg-emerald-600" : ""}>{MOVEMENT_LABELS[row.original.movement_type] || row.original.movement_type}</Badge>
    }},
    { accessorKey: "quantity", header: "Qtd", cell: ({ row }: any) => <span className="font-bold">{Math.abs(row.original.quantity)}</span> },
    { accessorKey: "performed_by_user", header: "Responsável", cell: ({ row }: any) => <span className="text-sm text-muted-foreground">{row.original.performed_by_user?.full_name || "Sistema"}</span> },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatório de Movimentações</h1>
          <p className="page-subtitle">Histórico completo de entradas e saídas de estoque</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/relatorios" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>← Voltar</Link>
          <ExportDialog data={movements} filename="relatorio-movimentacoes" title="Histórico de Movimentações" />
        </div>
      </div>
      <div className="kpi-grid">
        <KPICard title="Total de Movimentações" value={movements.length.toString()} icon={<Clock size={16} />} />
        <KPICard title="Entradas" value={entries.length.toString()} icon={<ArrowDownRight size={16} />} />
        <KPICard title="Saídas" value={exits.length.toString()} icon={<ArrowUpRight size={16} />} />
      </div>
      <div className="data-table-wrapper p-4">
        {isLoading ? <div className="h-48 flex items-center justify-center text-muted-foreground">Carregando...</div> : <DataTable columns={columns} data={movements} />}
      </div>
    </div>
  )
}
