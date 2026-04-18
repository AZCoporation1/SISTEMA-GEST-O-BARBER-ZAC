"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Plus, Search, Upload } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { useCustomers } from "../hooks/useCustomers"
import { CustomerNode } from "../types"
import { CustomerFormDialog } from "./CustomerFormDialog"
import { CustomerImportDialog } from "./CustomerImportDialog"

export function CustomersDashboard() {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerNode | null>(null)

  const { data, isLoading } = useCustomers({
    page: 1,
    perPage: 10000,
    search: search.length > 2 ? search : undefined
  })

  const cols = [
    { header: "Nome", accessorKey: "full_name" },
    { header: "Celular", accessorKey: "mobile_phone", cell: ({ row }: any) => row.original.mobile_phone || row.original.phone || "-" },
    { header: "E-mail", accessorKey: "email", cell: ({ row }: any) => row.original.email || "-" },
    { header: "CPF", accessorKey: "cpf", cell: ({ row }: any) => row.original.cpf || "-" },
    {
      id: "actions",
      cell: ({ row }: any) => actions(row.original)
    }
  ]

  const actions = (row: CustomerNode) => (
    <Button 
      variant="ghost" 
      size="sm"
      onClick={(e) => {
        e.stopPropagation()
        setSelectedCustomer(row)
        setFormOpen(true)
      }}
    >
      Editar
    </Button>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Clientes</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button onClick={() => { setSelectedCustomer(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail, celular ou CPF..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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

      <CustomerFormDialog 
        open={formOpen} 
        onOpenChange={setFormOpen} 
        customer={selectedCustomer} 
      />
      <CustomerImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
      />
    </div>
  )
}
