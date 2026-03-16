"use client"

import { useState } from "react"
import { useFixedCosts, useCostMutations } from "../hooks/useCosts"
import { DataTable } from "@/components/ui/data-table"
import { KPICard } from "@/components/ui/kpi-card"
import { Button } from "@/components/ui/button"
import { FilterBar } from "@/components/ui/filter-bar"
import { Plus, Power, PowerOff, CalendarDays } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { FixedCost, FixedCostFormValues, fixedCostSchema } from "../types"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription
} from "@/components/ui/dialog"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"

function FixedCostForm({ onSubmit, isLoading }: { onSubmit: (data: FixedCostFormValues) => void, isLoading: boolean }) {
  const form = useForm<FixedCostFormValues>({
    resolver: zodResolver(fixedCostSchema),
    defaultValues: { name: "", amount: 0, due_day: 1, category: "Geral", frequency: "monthly", is_active: true }
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Nome da Despesa*</FormLabel>
            <FormControl><Input placeholder="Ex: Aluguel do espaço" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="amount" render={({ field }) => (
            <FormItem>
              <FormLabel>Valor (R$)*</FormLabel>
              <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="due_day" render={({ field }) => (
            <FormItem>
              <FormLabel>Dia de Vencimento</FormLabel>
              <FormControl><Input type="number" min="1" max="31" {...field} value={field.value ?? ""} onChange={e => field.onChange(parseInt(e.target.value) || null)} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="category" render={({ field }) => (
          <FormItem>
            <FormLabel>Categoria*</FormLabel>
            <FormControl><Input placeholder="Ex: Infraestrutura, Pessoal" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Observações (Opcional)</FormLabel>
            <FormControl><Input {...field} value={field.value || ""} /></FormControl>
          </FormItem>
        )} />
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isLoading}>{isLoading ? "Salvando..." : "Salvar Custo Fixo"}</Button>
        </div>
      </form>
    </Form>
  )
}

export function FixedCostsView() {
  const [page] = useState(1)
  const [search, setSearch] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  
  const { data: costsData, isLoading } = useFixedCosts({ page, perPage: 50, search })
  const { createFixedCost, toggleStatus, isCreatingFixed } = useCostMutations()

  const columns: ColumnDef<FixedCost>[] = [
    { accessorKey: "name", header: "Despesa", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "category", header: "Categoria" },
    { accessorKey: "amount", header: "Valor", cell: ({ row }) => <span className="font-bold">R$ {row.original.amount.toFixed(2)}</span> },
    { accessorKey: "due_day", header: "Vencimento", cell: ({ row }) => <span>{row.original.due_day ? `Dia ${row.original.due_day}` : "—"}</span> },
    { accessorKey: "frequency", header: "Recorrência" },
    { accessorKey: "is_active", header: "Status", cell: ({ row }) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.original.is_active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400'}`}>
        {row.original.is_active ? "Ativo" : "Inativo"}
      </span>
    )},
    {
      id: "actions",
      cell: ({ row }) => {
        const cost = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => toggleStatus({ id: cost.id, currentStatus: cost.is_active })}
                className={cost.is_active ? "text-destructive" : "text-emerald-600"}
              >
                {cost.is_active ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
                {cost.is_active ? "Desativar" : "Ativar"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    },
  ]

  const totalActive = (costsData?.data || []).filter((c: any) => c.is_active).reduce((acc: number, curr: any) => acc + curr.amount, 0)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Custos Fixos</h1>
          <p className="page-subtitle">Despesas recorrentes do salão (aluguel, energia, etc.)</p>
        </div>
        <div className="page-actions">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="btn-gold"><Plus className="mr-2 h-4 w-4" /> Nova Despesa Fixa</Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Despesa Recorrente</DialogTitle>
              <DialogDescription>Despesas fixas entram na previsão de fluxo de caixa automaticamente.</DialogDescription>
            </DialogHeader>
            <FixedCostForm
              isLoading={isCreatingFixed}
              onSubmit={async (data) => {
                await createFixedCost(data)
                setIsCreateOpen(false)
              }}
            />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard title="Total Previsto Fixo/Mês" value={`R$ ${totalActive.toFixed(2)}`} icon={<CalendarDays />} />
        <KPICard title="Despesas Ativas" value={((costsData?.data || []).filter((c: any) => c.is_active).length).toString()} icon={<Power />} />
      </div>

      <div className="data-table-wrapper p-4">
        <FilterBar searchValue={search} onSearchChange={setSearch} placeholder="Buscar despesa fixa..." />
        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground">Carregando custos...</div>
        ) : (
          <DataTable columns={columns} data={costsData?.data || []} />
        )}
      </div>
    </div>
  )
}
