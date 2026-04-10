"use client"

import { useState } from "react"
import { useFixedCosts, useVariableCosts, useCostMutations } from "../hooks/useCosts"
import { DataTable } from "@/components/ui/data-table"
import { KPICard } from "@/components/ui/kpi-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Receipt, CalendarDays, TrendingDown, Power, PowerOff, DollarSign } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription
} from "@/components/ui/dialog"
import { FixedCostForm, VariableCostForm } from "./CostForms"

const FREQ_LABELS: Record<string, string> = {
  monthly: "Mensal", weekly: "Semanal", yearly: "Anual", biweekly: "Quinzenal",
}

export function CostsDashboard() {
  const [isFixedOpen, setIsFixedOpen] = useState(false)
  const [isVariableOpen, setIsVariableOpen] = useState(false)

  const { data: fixedCosts, isLoading: fixedLoading } = useFixedCosts({ page: 1, perPage: 100 })
  const { data: variableCosts, isLoading: variableLoading } = useVariableCosts({ page: 1, perPage: 100 })
  const { createFixedCost, isCreatingFixed, createVariableCost, isCreatingVariable, toggleStatus } = useCostMutations()

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const fixedData = (fixedCosts as any)?.data || fixedCosts || []
  const variableData = (variableCosts as any)?.data || variableCosts || []

  const totalFixedActive = (Array.isArray(fixedData) ? fixedData : []).filter((c: any) => c.is_active).reduce((a: number, c: any) => a + Number(c.amount || 0), 0)
  const totalVariable = (Array.isArray(variableData) ? variableData : []).reduce((a: number, c: any) => a + Number(c.amount || 0), 0)

  const fixedColumns = [
    { accessorKey: "name", header: "Nome", cell: ({ row }: any) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "category", header: "Categoria" },
    { accessorKey: "frequency", header: "Recorrência", cell: ({ row }: any) => <span>{FREQ_LABELS[row.original.frequency] || row.original.frequency}</span> },
    { accessorKey: "due_day", header: "Vencimento", cell: ({ row }: any) => <span>{row.original.due_day ? `Dia ${row.original.due_day}` : "—"}</span> },
    { accessorKey: "amount", header: "Valor", cell: ({ row }: any) => <span className="font-bold">{fmt(Number(row.original.amount))}</span> },
    { accessorKey: "is_active", header: "Status", cell: ({ row }: any) => {
      const active = row.original.is_active
      return (
        <Button
          variant="ghost"
          size="sm"
          className={active ? "text-emerald-600" : "text-muted-foreground"}
          onClick={() => toggleStatus({ id: row.original.id, currentStatus: active })}
        >
          {active ? <Power className="h-4 w-4 mr-1" /> : <PowerOff className="h-4 w-4 mr-1" />}
          {active ? "Ativo" : "Inativo"}
        </Button>
      )
    }},
  ]

  const variableColumns = [
    { accessorKey: "name", header: "Descrição", cell: ({ row }: any) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "category", header: "Categoria" },
    { accessorKey: "occurred_on", header: "Data", cell: ({ row }: any) => <span>{new Date(row.original.occurred_on).toLocaleDateString('pt-BR')}</span> },
    { accessorKey: "amount", header: "Valor", cell: ({ row }: any) => <span className="font-bold">{fmt(Number(row.original.amount))}</span> },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Custos</h1>
          <p className="page-subtitle">Gestão de custos fixos e variáveis da operação.</p>
        </div>
        <div className="page-actions flex items-center gap-2">
          <Dialog open={isVariableOpen} onOpenChange={setIsVariableOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Custo Variável</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Novo Custo Variável</DialogTitle>
                <DialogDescription>Registre uma despesa pontual ou eventual.</DialogDescription>
              </DialogHeader>
              <VariableCostForm
                isLoading={isCreatingVariable}
                onSubmit={async (data) => {
                  await createVariableCost(data)
                  setIsVariableOpen(false)
                }}
              />
            </DialogContent>
          </Dialog>

          <Dialog open={isFixedOpen} onOpenChange={setIsFixedOpen}>
            <DialogTrigger asChild>
              <Button className="btn-gold"><Plus className="mr-2 h-4 w-4" /> Custo Fixo</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Novo Custo Fixo</DialogTitle>
                <DialogDescription>Cadastre uma despesa recorrente da operação.</DialogDescription>
              </DialogHeader>
              <FixedCostForm
                isLoading={isCreatingFixed}
                onSubmit={async (data) => {
                  await createFixedCost(data)
                  setIsFixedOpen(false)
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard title="Custos Fixos Ativos/Mês" value={fmt(totalFixedActive)} icon={<CalendarDays size={16} />} />
        <KPICard title="Custos Variáveis (Período)" value={fmt(totalVariable)} icon={<TrendingDown size={16} />} />
        <KPICard title="Total Geral" value={fmt(totalFixedActive + totalVariable)} icon={<DollarSign size={16} />} className="border-amber-500/30" />
      </div>

      {/* Fixed Costs */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Custos Fixos
          </span>
          <span className="text-xs text-muted-foreground">Mensais recorrentes</span>
        </div>
        <div className="section-card-body p-0">
          {fixedLoading ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando...</div>
          ) : (Array.isArray(fixedData) && fixedData.length > 0) ? (
            <DataTable columns={fixedColumns} data={fixedData} />
          ) : (
            <div className="empty-state py-8">
              <Receipt className="empty-state-icon" />
              <h3 className="empty-state-title">Nenhum custo fixo cadastrado</h3>
              <p className="empty-state-description">Clique em "Custo Fixo" acima para começar.</p>
            </div>
          )}
        </div>
      </div>

      {/* Variable Costs */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title flex items-center gap-2">
            <TrendingDown className="h-4 w-4" /> Custos Variáveis
          </span>
          <span className="text-xs text-muted-foreground">Por período</span>
        </div>
        <div className="section-card-body p-0">
          {variableLoading ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando...</div>
          ) : (Array.isArray(variableData) && variableData.length > 0) ? (
            <DataTable columns={variableColumns} data={variableData} />
          ) : (
            <div className="empty-state py-8">
              <Receipt className="empty-state-icon" />
              <h3 className="empty-state-title">Nenhum custo variável no período</h3>
              <p className="empty-state-description">Registre custos pontuais usando o botão acima.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
