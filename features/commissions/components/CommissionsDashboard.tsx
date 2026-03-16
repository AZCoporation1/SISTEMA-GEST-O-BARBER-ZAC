"use client"

import { useState } from "react"
import { useCommissionEntries, useCommissionSummary, useCommissionCollaborators } from "../hooks/useCommissions"
import { DataTable } from "@/components/ui/data-table"
import { KPICard } from "@/components/ui/kpi-card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ColumnDef } from "@tanstack/react-table"
import { CommissionEntryWithRelations } from "../types"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { DollarSign, Users } from "lucide-react"

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function CommissionsDashboard() {
  const [selectedCollaborator, setSelectedCollaborator] = useState<string | undefined>(undefined)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())

  const { data: summary, isLoading: summaryLoading } = useCommissionSummary()
  const { data: collaboratorList } = useCommissionCollaborators()
  const { data: entries, isLoading: entriesLoading } = useCommissionEntries({
    collaboratorId: selectedCollaborator,
    month: selectedMonth,
    page: 1,
    perPage: 100,
  })

  // Current month summary
  const currentMonthSummary = summary?.find((s: any) => s.month?.startsWith(selectedMonth))
  const totalCommission = (currentMonthSummary as any)?.total_commission || 0
  const totalBase = (currentMonthSummary as any)?.total_base_commissionable || 0

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400",
    paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
  }
  const STATUS_LABELS: Record<string, string> = {
    pending: "Pendente",
    paid: "Pago",
    cancelled: "Cancelado",
  }

  const columns: ColumnDef<CommissionEntryWithRelations>[] = [
    {
      accessorKey: "competence_date",
      header: "Competência",
      cell: ({ row }) => <span>{format(new Date(row.original.competence_date), "dd/MM/yyyy", { locale: ptBR })}</span>
    },
    {
      accessorKey: "collaborator",
      header: "Colaborador",
      cell: ({ row }) => <span className="font-medium">{row.original.collaborator?.name || "—"}</span>
    },
    {
      accessorKey: "base_amount",
      header: "Base (R$)",
      cell: ({ row }) => <span>R$ {row.original.base_amount.toFixed(2)}</span>
    },
    {
      accessorKey: "commission_amount",
      header: "Comissão (R$)",
      cell: ({ row }) => <span className="font-bold text-emerald-600 dark:text-emerald-400">R$ {row.original.commission_amount.toFixed(2)}</span>
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[row.original.status] || ""}`}>
          {STATUS_LABELS[row.original.status] || row.original.status}
        </span>
      )
    },
  ]

  // Generate last 6 months for the select
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = format(d, "MMMM yyyy", { locale: ptBR })
    return { value, label }
  })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Comissões</h1>
          <p className="page-subtitle">Extrato de comissões por colaborador e período.</p>
        </div>
        <div className="page-actions">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedCollaborator || "all"} onValueChange={v => setSelectedCollaborator(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os colaboradores</SelectItem>
              {collaboratorList?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard title="Base Comissionável (Mês)" value={`R$ ${totalBase.toFixed(2)}`} icon={<DollarSign />} />
        <KPICard title="Total de Comissões (Mês)" value={`R$ ${totalCommission.toFixed(2)}`} icon={<DollarSign className="text-emerald-500" />} />
        <KPICard title="Colaboradores" value={(collaboratorList?.length || 0).toString()} icon={<Users />} />
      </div>

      <div className="data-table-wrapper p-4">
        <h3 className="section-card-title mb-4 px-2">Lançamentos de Comissão</h3>
        {entriesLoading ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground">Carregando...</div>
        ) : (
          <DataTable columns={columns} data={entries?.data || []} />
        )}
      </div>
    </div>
  )
}
