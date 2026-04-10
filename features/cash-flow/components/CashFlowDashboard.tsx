"use client"

import { useState } from "react"
import { useCashFlow } from "../hooks/useCashFlow"
import { KPICard } from "@/components/ui/kpi-card"
import { DataTable } from "@/components/ui/data-table"
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select"
import { TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { ExportDialog } from "@/features/import-export/components/ExportDialog"

export function CashFlowDashboard() {
  const [period, setPeriod] = useState<"day"|"week"|"month">("month")

  const { data, isLoading } = useCashFlow({ period })

  const columns = [
    {
      accessorKey: "occurred_on",
      header: "Data",
      cell: ({ row }: any) => <span className="text-sm">{format(new Date(row.original.occurred_on), "dd/MM/yyyy", { locale: ptBR })}</span>
    },
    {
      accessorKey: "movement_type",
      header: "Tipo",
      cell: ({ row }: any) => {
        const isIncome = row.original.movement_type === "received" || row.original.movement_type === "income"
        return (
          <Badge variant={isIncome ? "default" : "destructive"}>
            {isIncome ? "Entrada" : "Saída"}
          </Badge>
        )
      }
    },
    {
      accessorKey: "category",
      header: "Categoria",
    },
    {
      accessorKey: "subcategory",
      header: "Subcategoria",
      cell: ({ row }: any) => <span className="text-muted-foreground">{row.original.subcategory || "-"}</span>
    },
    {
      accessorKey: "description",
      header: "Descrição",
      cell: ({ row }: any) => <span className="truncate max-w-[200px]" title={row.original.description}>{row.original.description}</span>
    },
    {
      accessorKey: "amount",
      header: "Valor (R$)",
      cell: ({ row }: any) => {
        const isIncome = row.original.movement_type === "received" || row.original.movement_type === "income"
        return (
          <span className={`font-bold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
            {isIncome ? "+" : "-"} {row.original.amount.toFixed(2)}
          </span>
        )
      }
    }
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fluxo de Caixa</h1>
          <p className="page-subtitle">Consolidação de receitas e despesas {data?.periodStr ? `(${data.periodStr})` : ""}</p>
        </div>
        
        <div className="page-actions flex items-center gap-2">
          <ExportDialog data={data?.movements || []} filename="relatorio-fluxo-caixa" title="Fluxo de Caixa" />
          <Select value={period} onValueChange={(val: any) => setPeriod(val)}>
            <SelectTrigger className="w-[180px]">
               <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Visão Hoje</SelectItem>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!isLoading && data && (
        <div className="kpi-grid">
          <KPICard 
            title="Receita Total" 
            value={`R$ ${(data.summary.totalRevenue || 0).toFixed(2)}`} 
            icon={<TrendingUp className="text-emerald-500" />} 
          />
          <KPICard 
            title="Despesas Totais" 
            value={`R$ ${(data.summary.totalExpenses || 0).toFixed(2)}`} 
            icon={<TrendingDown className="text-destructive" />} 
          />
          <KPICard 
            title="Lucro Líquido Real" 
            value={`R$ ${(data.summary.netProfit || 0).toFixed(2)}`} 
            icon={<DollarSign />} 
            className={(data.summary.netProfit || 0) >= 0 ? "border-emerald-500" : "border-destructive"}
          />
          <KPICard 
            title="Margem de Lucro" 
            value={`${(data.summary.profitMargin || 0).toFixed(1)}%`} 
            icon={<Activity />} 
            className={(data.summary.profitMargin || 0) >= 20 ? "bg-emerald-50 dark:bg-emerald-950/20" : ""}
          />
        </div>
      )}

      <div className="data-table-wrapper p-4">
        <h3 className="section-card-title mb-4 px-2">Lançamentos Financeiros (DRE Simplificado)</h3>
        {isLoading ? (
          <div className="h-48 flex items-center justify-center">Buscando fluxo...</div>
        ) : (
          <DataTable columns={columns} data={data?.movements || []} />
        )}
      </div>
    </div>
  )
}
