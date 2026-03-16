"use client"

import { useState } from "react"
import { useMovements, useMovementMutations } from "../hooks/useMovements"
import { DataTable } from "@/components/ui/data-table"
import { FilterBar } from "@/components/ui/filter-bar"
import { Button } from "@/components/ui/button"
import { Plus, ArrowDownRight, ArrowUpRight } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { StockMovementWithRelations, MovementType } from "../types"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog"
import { MovementForm } from "./MovementForm"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"

const MOVEMENT_LABELS: Record<string, string> = {
  "initial_balance": "Saldo Inicial",
  "purchase_entry": "Entrada de Compra",
  "manual_adjustment_in": "Ajuste Manual (Entrada)",
  "return_from_customer": "Retorno de Cliente",
  "sale_exit": "Saída por Venda",
  "internal_consumption": "Consumo Interno",
  "loss": "Retirada/Perda",
  "damage": "Dano/Avaria",
  "manual_adjustment_out": "Ajuste Manual (Saída)",
  "transfer": "Transferência",
  "supplier_return": "Devolução ao Fornecedor",
}

export function MovementsView() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState<MovementType | "all">("all")
  
  const { data: movementsData, isLoading } = useMovements({
    page,
    perPage: 50,
    search,
    type: typeFilter
  })

  const { createMovement, isCreating } = useMovementMutations()

  const columns: ColumnDef<StockMovementWithRelations>[] = [
    {
      accessorKey: "movement_date",
      header: "Data/Hora",
      cell: ({ row }) => (
        <span className="text-sm">
          {format(new Date(row.original.movement_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </span>
      )
    },
    {
      accessorKey: "product",
      header: "Produto",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.product?.name || "Desconhecido"}</span>
      )
    },
    {
      accessorKey: "movement_type",
      header: "Tipo",
      cell: ({ row }) => {
        const type = row.original.movement_type
        const isEntry = ["initial_balance", "purchase_entry", "manual_adjustment_in", "return_from_customer"].includes(type)
        return (
          <Badge variant={isEntry ? "default" : "destructive"} className={isEntry ? "bg-emerald-600 hover:bg-emerald-700" : ""}>
            {isEntry ? <ArrowDownRight className="mr-1 h-3 w-3" /> : <ArrowUpRight className="mr-1 h-3 w-3" />}
            {MOVEMENT_LABELS[type] || type}
          </Badge>
        )
      }
    },
    {
      accessorKey: "quantity",
      header: "Qtd",
      cell: ({ row }) => (
        <span className="font-bold">{Math.abs(row.original.quantity)}</span>
      )
    },
    {
      accessorKey: "performed_by_user",
      header: "Responsável",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.performed_by_user?.full_name || "Sistema"}</span>
      )
    },
    {
      accessorKey: "movement_reason",
      header: "Motivo / Notas",
      cell: ({ row }) => (
        <div className="max-w-[200px] truncate text-sm" title={`${row.original.movement_reason} ${row.original.notes || ''}`}>
          {row.original.movement_reason}
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Movimentações</h1>
          <p className="page-subtitle">Histórico de entradas, saídas e ajustes de estoque.</p>
        </div>
        
        <div className="page-actions">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="btn-gold"><Plus className="mr-2 h-4 w-4" /> Nova Movimentação</Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Registrar Movimentação Manual</DialogTitle>
              <DialogDescription>Ajuste o estoque lançando uma entrada ou saída justificada.</DialogDescription>
            </DialogHeader>
            <MovementForm 
              isLoading={isCreating}
              onSubmit={async (data) => {
                await createMovement(data)
                setIsCreateOpen(false)
              }} 
            />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="data-table-wrapper p-4">
        <FilterBar 
          searchValue={search} 
          onSearchChange={setSearch} 
          placeholder="Buscar nas notas..."
        >
           {/* Room for Type Filter Select component in the future, kept simple for MVP */}
        </FilterBar>
        
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando movimentações...</div>
        ) : (
          <DataTable 
            columns={columns} 
            data={movementsData?.data || []} 
          />
        )}
      </div>
    </div>
  )
}
