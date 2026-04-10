"use client"

import { useState } from "react"
import { useInventory, useProductMutations, useCategories, useBrands } from "../hooks/useInventory"
import { useMovementMutations } from "@/features/movements/hooks/useMovements"
import { DataTable } from "@/components/ui/data-table"
import { FilterBar } from "@/components/ui/filter-bar"
import { KPICard } from "@/components/ui/kpi-card"
import { Button } from "@/components/ui/button"
import { Plus, Package, AlertTriangle, TrendingDown, Edit, Power, PowerOff, ArrowLeftRight, ArrowDownRight, ArrowUpRight, History } from "lucide-react"
import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import { InventoryPosition } from "../types"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog"
import { ProductForm } from "./ProductForm"
import { MovementForm } from "@/features/movements/components/MovementForm"
import { ExportDialog } from "@/features/import-export/components/ExportDialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getProductById } from "../services/inventory.service"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function InventoryView() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState("all")
  const [brandId, setBrandId] = useState("all")
  const [status, setStatus] = useState<any>("all")
  const [skuFamily, setSkuFamily] = useState<string>("")

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [productToEdit, setProductToEdit] = useState<any>(null)
  
  // Movement Modal States
  const [isMovementOpen, setIsMovementOpen] = useState(false)
  const [movementProductId, setMovementProductId] = useState<string>("")
  const [movementType, setMovementType] = useState<string>("")

  const { data: categories } = useCategories()
  const { data: brands } = useBrands()

  const { data: inventoryData, isLoading } = useInventory({
    page,
    perPage: 50,
    search,
    categoryId: categoryId !== "all" ? categoryId : undefined,
    brandId: brandId !== "all" ? brandId : undefined,
    skuFamily: skuFamily || undefined,
    status: status
  })

  const { createProduct, updateProduct, toggleStatus, isCreating, isUpdating, isToggling } = useProductMutations()
  const { createMovement, isCreating: isCreatingMovement } = useMovementMutations()

  const handleEditClick = async (id: string) => {
    try {
      const fullProduct = await getProductById(id)
      setProductToEdit(fullProduct)
      setIsEditOpen(true)
    } catch (error) {
      console.error("Failed to load product for editing", error)
    }
  }

  const handleOpenMovement = (id: string, type: string) => {
    setMovementProductId(id)
    setMovementType(type)
    setIsMovementOpen(true)
  }

  const columns: ColumnDef<InventoryPosition>[] = [
    {
      accessorKey: "product_name",
      header: "Produto",
      cell: ({ row }) => {
        const code = (row.original as any).external_code || (row.original as any).sku || null
        return (
          <div>
            <div className="flex items-center gap-2">
              {code && (
                <span className="text-[11px] font-semibold tracking-wider text-[var(--accent)] font-mono bg-[var(--accent-subtle)] px-1.5 py-0.5 rounded" style={{ letterSpacing: '0.06em' }}>
                  {code}
                </span>
              )}
              <p className="font-medium">{row.original.product_name}</p>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 ml-0">{row.original.category_name} · {row.original.brand_name || 'Sem marca'}</p>
          </div>
        )
      }
    },
    {
      accessorKey: "current_balance",
      header: "Saldo",
      cell: ({ row }) => {
        const balance = row.original.current_balance || 0
        const min = row.original.min_stock || 0
        const isLow = balance <= min

        return (
          <div className="flex items-center gap-2">
             <Badge variant={isLow ? "destructive" : "default"} className={!isLow ? "bg-emerald-600 hover:bg-emerald-700" : ""}>
               {balance} un
             </Badge>
             {isLow && <AlertTriangle className="h-4 w-4 text-destructive" />}
          </div>
        )
      }
    },
    {
      accessorKey: "sale_price",
      header: "Preço de Venda",
      cell: ({ row }) => {
        const price = row.original.sale_price || 0
        return <span className="font-bold text-emerald-600 dark:text-emerald-400">R$ {price.toFixed(2)}</span>
      }
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => {
        const active = (row.original as any).is_active ?? true
        return (
           <Badge variant="outline" className={active ? "text-emerald-600 border-emerald-600" : "text-muted-foreground"}>
             {active ? "Ativo" : "Inativo"}
           </Badge>
        )
      }
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const id = row.original.product_id!
        const isActive = (row.original as any).is_active ?? true
        
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Gestão do Produto</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleEditClick(id)}>
                <Edit className="mr-2 h-4 w-4" /> Editar Cadastro
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/movimentacoes?search=${encodeURIComponent(row.original.product_name || "")}`}>
                  <History className="mr-2 h-4 w-4" /> Histórico do Item
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Movimentar Estoque</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleOpenMovement(id, "purchase_entry")}>
                <ArrowDownRight className="mr-2 h-4 w-4 text-emerald-600" /> Registrar Compra/Entrada
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenMovement(id, "loss")}>
                <ArrowUpRight className="mr-2 h-4 w-4 text-destructive" /> Lançar Perda/Avaria
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenMovement(id, "manual_adjustment_in")}>
                <ArrowLeftRight className="mr-2 h-4 w-4" /> Ajuste Manual
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => toggleStatus({ id, currentStatus: isActive })}
                className={isActive ? "text-destructive focus:bg-destructive/10" : "text-emerald-600 focus:bg-emerald-600/10"}
              >
                {isActive ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
                {isActive ? "Desativar Produto" : "Reativar Produto"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const safeData = inventoryData?.data || []
  const totalValue = safeData.reduce((acc, item) => acc + (item.total_sale_value || 0), 0)
  const totalCost = safeData.reduce((acc, item) => acc + (item.total_cost_value || 0), 0)
  const itemsBelowMin = safeData.filter(item => (item.current_balance || 0) <= (item.min_stock || 0)).length

  return (
    <div className="space-y-6">
      <div className="page-header flex-col sm:flex-row items-start sm:items-center">
        <div className="w-full sm:w-auto">
          <h1 className="page-title">Estoque</h1>
          <p className="page-subtitle text-xs sm:text-sm">Gestão premium de produtos e posições.</p>
        </div>
        
        <div className="page-actions w-full sm:w-auto flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
          <div className="flex-1 sm:flex-none">
            <ExportDialog 
              data={safeData} 
              filename={`estoque_baiber_zac_${new Date().toISOString().split('T')[0]}`}
              title="Relatório de Estoque - Barber Zac"
              buttonText="Exportar"
            />
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="btn-gold flex-1 sm:flex-none"><Plus className="mr-2 h-4 w-4" /> Novo Produto</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] h-auto max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo Produto</DialogTitle>
                <DialogDescription>Cadastre um novo item detalhado no estoque.</DialogDescription>
              </DialogHeader>
              <ProductForm 
                isLoading={isCreating}
                onSubmit={async (data) => {
                  await createProduct(data)
                  setIsCreateOpen(false)
                }} 
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard 
          title="Valor Unitário Total (Venda)" 
          value={`R$ ${totalValue.toFixed(2)}`} 
          icon={<Package />} 
        />
        <KPICard 
          title="Custo Imobilizado" 
          value={`R$ ${totalCost.toFixed(2)}`} 
          icon={<TrendingDown />} 
        />
        <KPICard 
          title="Alertas de Estoque" 
          value={itemsBelowMin.toString()} 
          icon={<AlertTriangle className={itemsBelowMin > 0 ? "text-danger" : ""} />} 
          className={itemsBelowMin > 0 ? "border-danger/50 bg-danger/5" : ""}
          description="Itens abaixo do mínimo"
        />
      </div>

      <div className="data-table-wrapper p-4">
        {/* Smart SKU Family Segmentation */}
        <div className="flex items-center gap-1 mb-4 p-1 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] w-fit">
          {[
            { value: "", label: "Todos" },
            { value: "INSU", label: "INSU" },
            { value: "BEBI", label: "BEBI" },
            { value: "PERF", label: "PERF" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setSkuFamily(tab.value); setPage(1) }}
              className={`px-3 py-1.5 text-xs font-semibold tracking-wider rounded-md transition-all duration-150 ${
                skuFamily === tab.value
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-subtle)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <FilterBar 
          searchValue={search} 
          onSearchChange={setSearch} 
          placeholder="Buscar produto por nome ou código..."
        >
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Categorias</SelectItem>
              {categories?.filter((c: any) => c.id).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Marcas</SelectItem>
              {brands?.filter((b: any) => b.id).map((b: any) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Status do Estoque" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
              <SelectItem value="low_stock">Estoque Baixo</SelectItem>
              <SelectItem value="out_of_stock">Sem Estoque</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>
        
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando estoque premium...</div>
        ) : safeData.length === 0 ? (
          <div className="empty-state">
             <Package className="empty-state-icon" />
             <h3 className="empty-state-title">Nenhum produto encontrado</h3>
             <p className="empty-state-description">Tente ajustar os filtros ou cadastre um novo produto usando o botão acima.</p>
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={safeData} 
          />
        )}
      </div>

      {/* Edit Modal (mounted separately to preserve data fetching) */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[700px] h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
          </DialogHeader>
          {productToEdit && (
            <ProductForm 
              initialData={productToEdit as any} 
              isLoading={isUpdating}
              onSubmit={async (data) => {
                await updateProduct({ id: productToEdit.id, data })
                setIsEditOpen(false)
              }} 
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Quick Action Movement Modal */}
      <Dialog open={isMovementOpen} onOpenChange={setIsMovementOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Lançamento de Estoque Rápido</DialogTitle>
            <DialogDescription>Ajuste os valores de estoque do produto selecionado.</DialogDescription>
          </DialogHeader>
          {isMovementOpen && movementProductId && (
             <MovementForm
               initialProductId={movementProductId}
               initialType={movementType}
               isLoading={isCreatingMovement}
               onSubmit={async (data) => {
                 await createMovement(data)
                 setIsMovementOpen(false)
               }}
             />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
