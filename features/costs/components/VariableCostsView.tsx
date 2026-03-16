"use client"

import { useState } from "react"
import { useVariableCosts, useCostMutations } from "../hooks/useCosts"
import { DataTable } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { FilterBar } from "@/components/ui/filter-bar"
import { Plus, TrendingDown } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { VariableCost, VariableCostFormValues, variableCostSchema } from "../types"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription
} from "@/components/ui/dialog"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { KPICard } from "@/components/ui/kpi-card"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

function VariableCostForm({ onSubmit, isLoading }: { onSubmit: (data: VariableCostFormValues) => void, isLoading: boolean }) {
  const form = useForm<VariableCostFormValues>({
    resolver: zodResolver(variableCostSchema),
    defaultValues: { name: "", amount: 0, category: "", notes: "" }
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Descrição da Despesa*</FormLabel>
            <FormControl><Input placeholder="Ex: Compra de produto para divulgação" {...field} /></FormControl>
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
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria*</FormLabel>
              <FormControl><Input placeholder="Ex: Marketing, Manutenção" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Observações (Opcional)</FormLabel>
            <FormControl><Input {...field} value={field.value || ""} /></FormControl>
          </FormItem>
        )} />
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isLoading}>{isLoading ? "Registrando..." : "Registrar Custo"}</Button>
        </div>
      </form>
    </Form>
  )
}

export function VariableCostsView() {
  const [page] = useState(1)
  const [search, setSearch] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const { data: costsData, isLoading } = useVariableCosts({ page, perPage: 50, search })
  const { createVariableCost, isCreatingVariable } = useCostMutations()

  const columns: ColumnDef<VariableCost>[] = [
    { accessorKey: "occurred_on", header: "Data", cell: ({ row }) => (
      <span>{format(new Date(row.original.occurred_on), "dd/MM/yyyy", { locale: ptBR })}</span>
    )},
    { accessorKey: "name", header: "Descrição", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "category", header: "Categoria" },
    { accessorKey: "amount", header: "Valor", cell: ({ row }) => (
      <span className="font-bold text-destructive">R$ {row.original.amount.toFixed(2)}</span>
    )},
    { accessorKey: "notes", header: "Observações", cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">{row.original.notes || "—"}</span>
    )},
  ]

  const total = (costsData?.data || []).reduce((acc, curr) => acc + curr.amount, 0)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Custos Variáveis</h1>
          <p className="page-subtitle">Despesas eventuais e não recorrentes.</p>
        </div>
        <div className="page-actions">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="btn-gold"><Plus className="mr-2 h-4 w-4" /> Lançar Despesa</Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Despesa Variável</DialogTitle>
              <DialogDescription>Registra uma despesa eventual no fluxo financeiro consolidado.</DialogDescription>
            </DialogHeader>
            <VariableCostForm
              isLoading={isCreatingVariable}
              onSubmit={async (data) => {
                await createVariableCost(data)
                setIsCreateOpen(false)
              }}
            />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard title="Total Lançado (período visível)" value={`R$ ${total.toFixed(2)}`} icon={<TrendingDown className="text-destructive" />} />
        <KPICard title="Lançamentos" value={(costsData?.count || 0).toString()} icon={<TrendingDown />} />
      </div>

      <div className="data-table-wrapper p-4">
        <FilterBar searchValue={search} onSearchChange={setSearch} placeholder="Buscar despesa variável..." />
        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground">Carregando...</div>
        ) : (
          <DataTable columns={columns} data={costsData?.data || []} />
        )}
      </div>
    </div>
  )
}
