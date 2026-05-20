"use client"

import { useState } from "react"
import { Plus, Search, Upload, Trash2, Pencil } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { useServices, useServiceMutations } from "../hooks/useServices"
import { ServiceNode } from "../types"
import { ServiceFormDialog } from "./ServiceFormDialog"
import { ServiceImportDialog } from "./ServiceImportDialog"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"

export function ServicesDashboard() {
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<ServiceNode | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [serviceToDelete, setServiceToDelete] = useState<ServiceNode | null>(null)

  const { data, isLoading } = useServices({
    page: 1,
    perPage: 10000,
    search: search.length > 2 ? search : undefined
  })

  const { deleteService, isDeleting } = useServiceMutations()

  const handleDeleteClick = (service: ServiceNode, e: React.MouseEvent) => {
    e.stopPropagation()
    setServiceToDelete(service)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!serviceToDelete) return
    try {
      await deleteService(serviceToDelete.id)
      setDeleteDialogOpen(false)
      setServiceToDelete(null)
    } catch {
      // Error is handled by the mutation's onError (toast)
      // Keep dialog open so user sees the context
    }
  }

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false)
    setServiceToDelete(null)
  }

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
    <div className="flex items-center gap-1">
      <Button 
        variant="ghost" 
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          setSelectedService(row)
          setFormOpen(true)
        }}
      >
        <Pencil className="mr-1 h-3.5 w-3.5" />
        Editar
      </Button>
      <Button 
        variant="ghost" 
        size="sm"
        className="text-[var(--danger)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)]"
        onClick={(e) => handleDeleteClick(row, e)}
        disabled={isDeleting}
      >
        <Trash2 className="mr-1 h-3.5 w-3.5" />
        Excluir
      </Button>
    </div>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o serviço{" "}
              <strong className="text-[var(--text-primary)]">
                {serviceToDelete?.name}
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete} disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-[var(--danger-bg)] text-[var(--danger)] border-[rgba(239,68,68,0.2)] hover:bg-[rgba(239,68,68,0.15)]"
            >
              {isDeleting ? "Excluindo..." : "Sim, Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
