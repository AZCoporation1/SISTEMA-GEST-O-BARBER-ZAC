"use client"

import { useState } from "react"
import { Plus, Search, Upload } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { useServices } from "../hooks/useServices"
import { ServiceNode } from "../types"
import { ServiceFormDialog } from "./ServiceFormDialog"
import { ServiceImportDialog } from "./ServiceImportDialog"
import { Badge } from "@/components/ui/badge"

export function ServicesDashboard() {
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<ServiceNode | null>(null)

  const { data, isLoading } = useServices({
    page: 1,
    perPage: 10000,
    search: search.length > 2 ? search : undefined
  })

  const cols = [
    { header: "Nome", accessorKey: "name" },
    { header: "Categoria", accessorKey: "category", cell: ({ row }: any) => row.original.category?.name || "-" },
    { header: "Duração", accessorKey: "duration_minutes", cell: ({ row }: any) => `${row.original.duration_minutes} min` },
    { 
      header: "Valor", 
      accessorKey: "price", 
      cell: ({ row }: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.original.price) 
    },
    { 
      header: "Status", 
      accessorKey: "is_active", 
      cell: ({ row }: any) => (
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? "Ativo" : "Inativo"}
        </Badge>
      )
    },
    {
      id: "actions",
      cell: ({ row }: any) => actions(row.original)
    }
  ]

  const actions = (row: ServiceNode) => (
    <Button 
      variant="ghost" 
      size="sm"
      onClick={(e) => {
        e.stopPropagation()
        setSelectedService(row)
        setFormOpen(true)
      }}
    >
      Editar
    </Button>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Catálogo de Serviços</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button onClick={() => { setSelectedService(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Serviço
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do serviço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="bg-card w-full border rounded-lg overflow-hidden p-4">
        <DataTable
          columns={cols}
          data={data?.data || []}
        />
      </div>

      <ServiceFormDialog 
        open={formOpen} 
        onOpenChange={setFormOpen} 
        service={selectedService} 
      />
      
      <ServiceImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
      />
    </div>
  )
}
